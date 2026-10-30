import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import { createPaySuiteCharge, normalizePaymentReference } from '../payments/paysuite.service';
import { resolveSandboxFixedAmount } from '../../lib/sandbox-payments';
import { getPlan } from '../../lib/plans';

export interface InvoiceDTO {
  id: string;
  reference: string;
  planCode: string;
  planName: string;
  amountMinorUnits: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  periodStart: string;
  periodEnd: string;
  checkoutUrl: string | null;
  providerReference: string | null;
  paidAt: string | null;
  createdAt: string;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function generateReference(): string {
  return `SUB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export class SubscriptionInvoiceService {
  private static toDTO(invoice: any): InvoiceDTO {
    const plan = getPlan(invoice.planCode);
    return {
      id: invoice.id,
      reference: invoice.reference,
      planCode: invoice.planCode,
      planName: plan.name,
      amountMinorUnits: invoice.amountMinorUnits,
      currency: invoice.currency,
      status: invoice.status as InvoiceDTO['status'],
      periodStart: invoice.periodStart.toISOString(),
      periodEnd: invoice.periodEnd.toISOString(),
      checkoutUrl: invoice.checkoutUrl || null,
      providerReference: invoice.providerReference || null,
      paidAt: invoice.paidAt?.toISOString() || null,
      createdAt: invoice.createdAt.toISOString()
    };
  }

  static async list(publisherId: string, limit = 12): Promise<InvoiceDTO[]> {
    const invoices = await prisma.publisherInvoice.findMany({
      where: { publisherId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return invoices.map((invoice: any) => this.toDTO(invoice));
  }

  /**
   * Cria a factura do próximo ciclo e pede a cobrança à PaySuite.
   * Se a PaySuite falhar (credenciais/host), a factura fica PENDING e o
   * administrador pode marcá-la como paga manualmente.
   */
  static async create(
    publisherId: string,
    actorUserId?: string | null
  ): Promise<InvoiceDTO> {
    const publisher = await prisma.publisher.findUnique({ where: { id: publisherId } });
    if (!publisher) {
      throw new AppError('Editora não encontrada.', 404, 'PUBLISHER_NOT_FOUND');
    }

    const plan = getPlan(publisher.planCode);
    const now = new Date();
    const periodStart = publisher.subscriptionRenewsAt && publisher.subscriptionRenewsAt > now
      ? publisher.subscriptionRenewsAt
      : now;
    const periodEnd = addMonths(periodStart, 1);

    const invoice = await prisma.publisherInvoice.create({
      data: {
        reference: generateReference(),
        publisherId,
        planCode: plan.code,
        amountMinorUnits: plan.priceMinorUnits,
        currency: 'MZN',
        status: 'PENDING',
        periodStart,
        periodEnd,
        createdById: actorUserId || null
      }
    });

    let updated = invoice;
    try {
      const baseUrl = (process.env.BASE_URL || '').replace(/\/+$/, '');
      const charge = await createPaySuiteCharge({
        amountMinorUnits: plan.priceMinorUnits,
        reference: invoice.reference,
        description: `VUKA ${plan.name} - ${publisher.name}`,
        phoneNumber: publisher.contactPhone,
        returnUrl: baseUrl ? `${baseUrl}/editora/subscricao` : undefined
      });

      updated = await prisma.publisherInvoice.update({
        where: { id: invoice.id },
        data: {
          providerReference: charge.id || null,
          checkoutUrl: charge.checkoutUrl || null
        }
      });
    } catch (error: any) {
      console.warn(
        `[SubscriptionInvoice] Cobrança PaySuite indisponível para ${invoice.reference}: ${error?.message || error}`
      );
    }

    await AuditService.record({
      actorUserId: actorUserId || null,
      publisherId,
      action: 'CREATE',
      entityType: 'PUBLISHER_INVOICE',
      entityId: invoice.id,
      reason: `Factura ${plan.name} ${invoice.reference} (${plan.priceMinorUnits} MZN)`,
      metadata: { reference: invoice.reference, planCode: plan.code }
    });

    return this.toDTO(updated);
  }

  /** Marca a factura como paga e estende a subscrição até ao fim do período. */
  static async markPaid(
    invoiceId: string,
    actorUserId?: string | null,
    providerReference?: string | null
  ): Promise<InvoiceDTO> {
    const invoice = await prisma.publisherInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new AppError('Factura não encontrada.', 404, 'INVOICE_NOT_FOUND');
    }

    if (invoice.status === 'PAID') {
      return this.toDTO(invoice);
    }

    const now = new Date();
    const paid = await prisma.publisherInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: now,
        providerReference: providerReference || invoice.providerReference
      }
    });

    await prisma.publisher.update({
      where: { id: invoice.publisherId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionRenewsAt: invoice.periodEnd
      }
    });

    await AuditService.record({
      actorUserId: actorUserId || null,
      publisherId: invoice.publisherId,
      action: 'UPDATE',
      entityType: 'PUBLISHER_INVOICE',
      entityId: invoice.id,
      reason: `Factura ${invoice.reference} paga — subscrição renovada até ${invoice.periodEnd.toISOString().slice(0, 10)}`,
      metadata: { reference: invoice.reference, amountMinorUnits: invoice.amountMinorUnits }
    });

    return this.toDTO(paid);
  }

  /**
   * Processa a notificação da PaySuite quando se refere a uma factura.
   * Devolve `true` se a notificação era de uma factura (e já foi tratada).
   */
  static async handlePaymentNotification(payload: any): Promise<boolean> {
    const data = payload?.data || payload || {};
    // A PaySuite devolve a referência sem separadores (SUBAB12CD) → normalizar
    const reference = normalizePaymentReference(String(data.reference || ''));

    if (!reference.startsWith('SUB-')) return false;

    const invoice = await prisma.publisherInvoice.findUnique({ where: { reference } });
    if (!invoice) return false;

    const event = String(payload?.event || '').toLowerCase();
    const status = String(data.status || '').toLowerCase();
    const isPaid =
      event === 'payment.success' ||
      event === 'payment.succeeded' ||
      event === 'payment.paid' ||
      ['paid', 'succeeded', 'completed'].includes(status);

    if (isPaid) {
      // Confere o valor cobrado (aceita o valor fixo de sandbox quando ligado)
      const receivedMinorUnits = Math.round(Number(data.amount ?? 0) * 100);
      const sandboxAmount = await resolveSandboxFixedAmount();
      const amountOk =
        receivedMinorUnits === invoice.amountMinorUnits ||
        (sandboxAmount !== null && receivedMinorUnits === sandboxAmount);

      if (!amountOk) {
        console.warn(
          `[SubscriptionInvoice] Valor divergente na factura ${invoice.reference}: ` +
            `recebido ${receivedMinorUnits} vs esperado ${invoice.amountMinorUnits} (minor units).`
        );
        return true;
      }

      await this.markPaid(invoice.id, null, data.id ? String(data.id) : null);
    }

    return true;
  }

  /**
   * Rotina de renovação: cria factura para os jornais cuja renovação já venceu
   * (ou vence hoje) e que ainda não têm factura pendente para o período.
   */
  static async runRenewals(now = new Date()): Promise<{
    processed: number;
    created: { publisherId: string; reference: string }[];
    skipped: number;
  }> {
    const due = await prisma.publisher.findMany({
      where: {
        subscriptionRenewsAt: { not: null, lte: now }
      },
      select: { id: true, name: true, subscriptionRenewsAt: true },
      take: 100
    });

    const created: { publisherId: string; reference: string }[] = [];
    let skipped = 0;

    for (const publisher of due) {
      const pending = await prisma.publisherInvoice.findFirst({
        where: { publisherId: publisher.id, status: 'PENDING' }
      });
      if (pending) {
        skipped += 1;
        continue;
      }

      const invoice = await this.create(publisher.id, null);
      created.push({ publisherId: publisher.id, reference: invoice.reference });
    }

    return { processed: due.length, created, skipped };
  }
}
