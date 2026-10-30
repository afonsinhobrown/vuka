import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error.middleware';
import {
  OrderStatus,
  PaymentStatus,
  PaymentProvider,
  EntitlementStatus,
  PaymentDTO,
  AuditEventAction,
  UserRole,
  UserStatus
} from '@vuka/shared';
import { AuditService } from '../audit/audit.service';
import { resolveSandboxFixedAmount } from '../../lib/sandbox-payments';
import { v4 as uuidv4 } from 'uuid';

export class PaymentService {
  /**
   * Inicia um pagamento para um pedido
   */
  static async initiatePayment(data: {
    orderId: string;
    provider: PaymentProvider;
    phoneNumber?: string;
  }): Promise<PaymentDTO> {
    const order = await prisma.order.findUnique({
      where: { id: data.orderId }
    });

    if (!order) {
      throw new AppError('Pedido não encontrado.', 404, 'ORDER_NOT_FOUND');
    }

    if (order.status === OrderStatus.PAID) {
      throw new AppError('Este pedido já foi pago.', 400, 'ORDER_ALREADY_PAID');
    }

    if (order.status === OrderStatus.EXPIRED || new Date(order.expiresAt) < new Date()) {
      throw new AppError('Este pedido expirou.', 400, 'ORDER_EXPIRED');
    }

    const idempotencyKey = `pay_${order.id}_${Date.now()}`;
    const providerReference = `REF_${Math.floor(100000 + Math.random() * 900000)}`;

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: data.provider,
        providerReference,
        status: PaymentStatus.PENDING,
        amountMinorUnits: order.totalMinorUnits,
        currency: order.currency,
        idempotencyKey,
        providerPayload: { phoneNumber: data.phoneNumber || order.buyerContact }
      }
    });

    return {
      id: payment.id,
      orderId: payment.orderId,
      provider: payment.provider as PaymentProvider,
      providerReference: payment.providerReference,
      status: payment.status as PaymentStatus,
      amountMinorUnits: payment.amountMinorUnits,
      currency: payment.currency,
      idempotencyKey: payment.idempotencyKey,
      createdAt: payment.createdAt.toISOString(),
      confirmedAt: null
    };
  }

  /**
   * Processador de Webhook estritamente IDEMPOTENTE com transação de BD
   * Garante RB-01, RB-02, CA-03 e CA-04
   */
  static async processWebhook(params: {
    provider: PaymentProvider;
    externalEventId: string;
    orderPublicReference: string;
    providerReference: string;
    amountMinorUnits: number;
    currency: string;
    status: 'CONFIRMED' | 'FAILED';
    rawPayload?: any;
  }) {
    const {
      provider,
      externalEventId,
      orderPublicReference,
      providerReference,
      amountMinorUnits,
      currency,
      status,
      rawPayload
    } = params;

    // 1. Verificação de Idempotência do Evento Externo
    const existingWebhook = await prisma.webhookEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider,
          externalEventId
        }
      }
    });

    if (existingWebhook && existingWebhook.processingStatus === 'PROCESSED') {
      return {
        alreadyProcessed: true,
        message: 'Evento de webhook já processado anteriormente com idempotência.'
      };
    }

    // 2. Localizar Pedido
    const order = await prisma.order.findUnique({
      where: { publicReference: orderPublicReference },
      include: { offer: true }
    });

    if (!order) {
      throw new AppError('Pedido associado à notificação não encontrado.', 404, 'ORDER_NOT_FOUND');
    }

    // 3. Validação de Valor e Moeda (RB-02 e RNF-08)
    let sandboxMismatch: { received: number; expected: number } | null = null;

    if (status === 'CONFIRMED') {
      const amountMatches =
        order.totalMinorUnits === amountMinorUnits && order.currency === currency;

      if (!amountMatches) {
        // Sandbox (ligado no painel admin): a PaySuite cobra um valor fixo
        // (10 MT) independentemente do preço do jornal. Só aceitamos se for
        // exactamente esse valor.
        const sandboxAmount = await resolveSandboxFixedAmount();
        const isSandboxCharge =
          sandboxAmount !== null && amountMinorUnits === sandboxAmount && currency === order.currency;

        if (!isSandboxCharge) {
          throw new AppError(
            `Incompatibilidade no valor/moeda recebido (${amountMinorUnits} ${currency}) vs esperado (${order.totalMinorUnits} ${order.currency})`,
            400,
            'AMOUNT_MISMATCH'
          );
        }

        sandboxMismatch = { received: amountMinorUnits, expected: order.totalMinorUnits };
        console.warn(
          `[SANDBOX] Pagamento aceite com valor fixo de sandbox: recebido ${amountMinorUnits} ${currency} ` +
            `para o pedido ${order.publicReference} (esperado ${order.totalMinorUnits} ${order.currency}).`
        );
      }
    }

    // 4. Transação Atômica de Atualização e Concessão de Direitos
    const result = await prisma.$transaction(async (tx: { [key: string]: any }) => {
      // 4.1 Registar ou atualizar WebhookEvent
      await tx.webhookEvent.upsert({
        where: {
          provider_externalEventId: {
            provider,
            externalEventId
          }
        },
        create: {
          provider,
          externalEventId,
          processingStatus: 'PROCESSED',
          payload: rawPayload || {},
          processedAt: new Date()
        },
        update: {
          processingStatus: 'PROCESSED',
          processedAt: new Date()
        }
      });

      if (status !== 'CONFIRMED') {
        // Regista pagamento com falha
        await tx.payment.create({
          data: {
            orderId: order.id,
            provider,
            providerReference,
            status: PaymentStatus.FAILED,
            amountMinorUnits,
            currency,
            idempotencyKey: `fail_${externalEventId}`,
            providerPayload: rawPayload
          }
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.FAILED }
        });

        return { orderStatus: OrderStatus.FAILED, entitlementGranted: false };
      }

      // 4.2 Localizar ou criar utilizador leitor vinculado ao contacto da compra
      let userId = order.userId;
      if (!userId) {
        const cleanPhone = order.buyerContact.replace(/\D/g, '');
        let user = await tx.user.findFirst({
          where: {
            OR: [
              { phone: cleanPhone },
              { email: order.buyerContact.toLowerCase() }
            ]
          }
        });

        if (!user) {
          user = await tx.user.create({
            data: {
              phone: cleanPhone || null,
              email: order.buyerContact.includes('@') ? order.buyerContact.toLowerCase() : null,
              displayName: order.buyerName || `Leitor ${cleanPhone.slice(-4) || 'VUKA'}`,
              role: UserRole.READER,
              status: UserStatus.ACTIVE
            }
          });
        }
        userId = user.id;
      }

      // 4.3 Registar Pagamento Confirmado
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          provider,
          providerReference,
          status: PaymentStatus.CONFIRMED,
          amountMinorUnits,
          currency,
          idempotencyKey: `conf_${externalEventId}`,
          providerPayload: rawPayload,
          confirmedAt: new Date()
        }
      });

      // 4.4 Atualizar Pedido para PAGO
      await tx.order.update({
        where: { id: order.id },
        data: {
          userId,
          status: OrderStatus.PAID,
          paidAt: new Date()
        }
      });

      // 4.5 Concessão do Direito de Acesso (Entitlement)
      const offer = order.offer;
      const startsAt = new Date();
      let endsAt: Date | null = null;

      if (offer.validityDays && offer.validityDays > 0) {
        endsAt = new Date(Date.now() + offer.validityDays * 24 * 60 * 60 * 1000);
      }

      // Prevenir direitos duplicados para o mesmo pedido
      const existingEntitlement = await tx.entitlement.findFirst({
        where: {
          userId,
          orderId: order.id
        }
      });

      let entitlementId = existingEntitlement?.id;

      if (!existingEntitlement) {
        let scope: any = 'EDITION';
        if ((offer as any).type === 'ALL_ACCESS') scope = 'ALL_ACCESS';
        else if ((offer as any).type === 'SUBSCRIPTION') scope = 'PUBLICATION';
        else if ((offer as any).type === 'ARTICLE') scope = 'ARTICLE';
        else if ((offer as any).type === 'SINGLE_EDITION') scope = 'EDITION';

        const newEntitlement = await tx.entitlement.create({
          data: {
            userId,
            orderId: order.id,
            editionId: offer.editionId || null,
            publicationId: offer.publicationId || null,
            articleId: (offer as any).articleId || null,
            scope,
            startsAt,
            endsAt,
            status: EntitlementStatus.ACTIVE,
            origin: 'ORDER'
          }
        });
        entitlementId = newEntitlement.id;
      }

      return {
        orderStatus: OrderStatus.PAID,
        entitlementGranted: true,
        entitlementId,
        paymentId: payment.id,
        userId
      };
    });

    // Registar evento de auditoria
    await AuditService.record({
      publisherId: order.offer.publisherId,
      action: AuditEventAction.GRANT_ENTITLEMENT,
      entityType: 'ORDER',
      entityId: order.id,
      reason: `Pagamento ${status} via ${provider}. Direito de acesso concedido.`,
      metadata: { externalEventId, amountMinorUnits, currency }
    });

    // Rasto explícito quando o valor de sandbox foi aceito por diferença
    if (sandboxMismatch) {
      await AuditService.record({
        publisherId: order.offer.publisherId,
        action: 'SANDBOX_PAYMENT_ACCEPTED',
        entityType: 'ORDER',
        entityId: order.id,
        reason:
          `Valor fixo de sandbox aceite: cobrado ${sandboxMismatch.received} em vez de ` +
          `${sandboxMismatch.expected} ${order.currency}.`,
        metadata: {
          externalEventId,
          provider,
          receivedMinorUnits: sandboxMismatch.received,
          expectedMinorUnits: sandboxMismatch.expected,
          currency
        }
      });
    }

    return result;
  }

  /**
   * Correção Manual de Pagamento (CA-09, RB-07)
   * Exige operador/admin autorizado e justificativa obrigatória registrada em auditoria
   */
  static async manualPaymentOverride(data: {
    actorUserId: string;
    orderId: string;
    newStatus: OrderStatus;
    reason: string;
  }) {
    if (!data.reason || data.reason.trim().length < 5) {
      throw new AppError('O motivo da correção manual é obrigatório para auditoria.', 400, 'REASON_REQUIRED');
    }

    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { offer: true }
    });

    if (!order) throw new AppError('Pedido não encontrado.', 404, 'ORDER_NOT_FOUND');

    const updated = await prisma.$transaction(async (tx: { [key: string]: any }) => {
      const o = await tx.order.update({
        where: { id: data.orderId },
        data: {
          status: data.newStatus,
          paidAt: data.newStatus === OrderStatus.PAID ? new Date() : undefined
        }
      });

      if (data.newStatus === OrderStatus.PAID && order.userId) {
        // Criar entitlement se ainda não tiver
        const exists = await tx.entitlement.findFirst({
          where: { orderId: order.id, userId: order.userId }
        });

        if (!exists) {
          let scope: any = 'EDITION';
          if ((order.offer as any).type === 'ALL_ACCESS') scope = 'ALL_ACCESS';
          else if ((order.offer as any).type === 'SUBSCRIPTION') scope = 'PUBLICATION';
          else if ((order.offer as any).type === 'ARTICLE') scope = 'ARTICLE';
          else if ((order.offer as any).type === 'SINGLE_EDITION') scope = 'EDITION';

          await tx.entitlement.create({
            data: {
              userId: order.userId,
              orderId: order.id,
              editionId: order.offer.editionId || null,
              publicationId: order.offer.publicationId || null,
              articleId: (order.offer as any).articleId || null,
              scope,
              startsAt: new Date(),
              endsAt: order.offer.validityDays
                ? new Date(Date.now() + order.offer.validityDays * 24 * 60 * 60 * 1000)
                : null,
              status: EntitlementStatus.ACTIVE,
              origin: 'MANUAL_OVERRIDE'
            }
          });
        }
      }

      return o;
    });

    await AuditService.record({
      actorUserId: data.actorUserId,
      publisherId: order.offer.publisherId,
      action: AuditEventAction.MANUAL_PAYMENT_OVERRIDE,
      entityType: 'ORDER',
      entityId: order.id,
      reason: data.reason,
      metadata: { oldStatus: order.status, newStatus: data.newStatus }
    });

    return updated;
  }
}
