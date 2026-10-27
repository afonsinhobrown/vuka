import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service';
import { PaymentProvider, UserRole } from '@vuka/shared';

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

  static async handlePaySuiteWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const { PaySuiteService, verifyPaySuiteWebhookSignature } = await import('./paysuite.service');
      const signature = req.headers['x-signature'] as string | undefined;

      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const isValid = verifyPaySuiteWebhookSignature(rawBody, signature);
      if (!isValid) {
        return res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Assinatura inválida do PaySuite.' } });
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
