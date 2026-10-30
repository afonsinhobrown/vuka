import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service';
import { PaymentProvider, UserRole } from '@vuka/shared';
import { AppError } from '../../middlewares/error.middleware';

export class PaymentController {
  static async initiate(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, provider, phoneNumber } = req.body;
      if (!orderId || !provider) {
        return res.status(400).json({
          error: { code: 'MISSING_FIELDS', message: 'Identificador do pedido e método de pagamento são obrigatórios.' }
        });
      }

      const result = await PaymentService.initiatePayment({
        orderId,
        provider: provider as PaymentProvider,
        phoneNumber
      });

      return res.status(201).json({ payment: result });
    } catch (error) {
      next(error);
    }
  }

  static async initiatePaySuite(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, method, phoneNumber } = req.body;
      const { PaySuiteService } = await import('./paysuite.service');
      const result = await PaySuiteService.createPayment({
        orderId,
        method,
        phoneNumber
      });

      return res.status(201).json({ payment: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Diagnóstico da configuração da PaySuite (não expõe segredos).
   */
  static async configStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const { getPaySuiteConfigStatus } = await import('./paysuite.service');
      const status = await getPaySuiteConfigStatus();
      return res.status(200).json({ payments: status });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Estado do modo sandbox (para o botão do painel admin).
   */
  static async getSandboxMode(_req: Request, res: Response, next: NextFunction) {
    try {
      const { resolveSandboxState } = await import('../../lib/sandbox-payments');
      const sandbox = await resolveSandboxState();
      return res.status(200).json({ sandbox });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Liga/desliga o modo sandbox (apenas ADMIN, com auditoria).
   */
  static async setSandboxMode(req: Request, res: Response, next: NextFunction) {
    try {
      const { enabled } = req.body || {};
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          error: { code: 'INVALID_PAYLOAD', message: 'O campo "enabled" tem de ser true ou false.' }
        });
      }

      const { setSandboxEnabled } = await import('../../lib/sandbox-payments');

      let sandbox;
      try {
        sandbox = await setSandboxEnabled(enabled, req.user?.userId);
      } catch {
        throw new AppError(
          'Não foi possível gravar a configuração. A tabela system_settings ainda não existe — corre `npm --workspace=apps/api run db:push`.',
          500,
          'SETTINGS_UNAVAILABLE'
        );
      }

      const { AuditService } = await import('../audit/audit.service');
      await AuditService.record({
        actorUserId: req.user?.userId || null,
        action: 'UPDATE',
        entityType: 'SYSTEM_SETTING',
        entityId: 'payments.sandbox',
        reason: enabled
          ? 'Modo sandbox dos pagamentos LIGADO (cobranças de teste).'
          : 'Modo sandbox dos pagamentos DESLIGADO (cobranças reais).',
        metadata: { enabled, amountMinorUnits: sandbox.amountMinorUnits }
      });

      return res.status(200).json({ sandbox });
    } catch (error) {
      next(error);
    }
  }

  static async handlePaySuiteWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const { PaySuiteService, verifyPaySuiteWebhookSignature } = await import('./paysuite.service');
      const signature = req.headers['x-signature'] as string | undefined;

      const rawBody =
        (req as unknown as { rawBody?: string }).rawBody ||
        (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const isValid = verifyPaySuiteWebhookSignature(rawBody, signature);
      if (!isValid) {
        return res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Assinatura inválida do PaySuite.' } });
      }

      // Notificações de facturas de subscrição (SUB-XXXXXX) são tratadas à parte
      const { SubscriptionInvoiceService } = await import('../subscriptions/invoice.service');
      const wasInvoice = await SubscriptionInvoiceService.handlePaymentNotification(req.body);
      if (wasInvoice) {
        return res.status(200).json({ received: true, type: 'SUBSCRIPTION_INVOICE' });
      }

      const result = await PaySuiteService.processWebhook(req.body);
      return res.status(200).json({ received: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const providerParam = (req.params.provider || req.body.provider || 'MOCK_SANDBOX').toUpperCase() as PaymentProvider;
      const {
        externalEventId,
        orderPublicReference,
        providerReference,
        amountMinorUnits,
        currency = 'MZN',
        status = 'CONFIRMED'
      } = req.body;

      if (!externalEventId || !orderPublicReference || amountMinorUnits === undefined) {
        return res.status(400).json({
          error: {
            code: 'INVALID_WEBHOOK_PAYLOAD',
            message: 'Campos obrigatórios ausentes no webhook (externalEventId, orderPublicReference, amountMinorUnits).'
          }
        });
      }

      const result = await PaymentService.processWebhook({
        provider: providerParam,
        externalEventId,
        orderPublicReference,
        providerReference: providerReference || externalEventId,
        amountMinorUnits: Number(amountMinorUnits),
        currency,
        status,
        rawPayload: req.body
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async manualOverride(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, newStatus, reason } = req.body;
      const result = await PaymentService.manualPaymentOverride({
        actorUserId: req.user!.userId,
        orderId,
        newStatus,
        reason
      });

      return res.status(200).json({ order: result });
    } catch (error) {
      next(error);
    }
  }
}
