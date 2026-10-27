import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error.middleware';
import { PaymentProvider, PaymentStatus, OrderStatus } from '@vuka/shared';
import { PaymentService } from './payment.service';

export interface PaySuitePaymentRequest {
  orderId: string;
  method?: 'mpesa' | 'emola' | 'credit_card';
  phoneNumber?: string;
}

export class PaySuiteService {
  private static get baseUrl(): string {
    return process.env.PAYSUITE_API_URL || 'https://paysuite.tech/api/v1';
  }

  private static get apiKey(): string | undefined {
    return process.env.PAYSUITE_API_KEY;
  }

  private static get webhookSecret(): string | undefined {
    return process.env.PAYSUITE_WEBHOOK_SECRET;
  }

  /**
   * Cria um pedido de pagamento no PaySuite
   */
  static async createPayment(data: PaySuitePaymentRequest) {
    const order = await prisma.order.findUnique({
      where: { id: data.orderId }
    });

    if (!order) {
      throw new AppError('Pedido não encontrado.', 404, 'ORDER_NOT_FOUND');
    }

    if (order.status === OrderStatus.PAID) {
      throw new AppError('Este pedido já foi pago.', 400, 'ORDER_ALREADY_PAID');
    }

    // Valor em Meticais decimais (ex: 5000 centavos = 50.00 MZN)
    const amountMzn = order.totalMinorUnits / 100;
    const method = data.method || 'mpesa';

    let paysuiteResponse: any = null;

    if (this.apiKey) {
      // Chamada real à API PaySuite
      const response = await fetch(`${this.baseUrl}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          amount: amountMzn,
          method,
          reference: order.publicReference,
          description: `VUKA - Pedido ${order.publicReference}`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AppError(`Erro no PaySuite: ${errorText}`, 400, 'PAYSUITE_GATEWAY_ERROR');
      }

      paysuiteResponse = await response.json();
    } else {
      // Modo Mock/Sandbox do PaySuite caso a chave ainda não tenha sido inserida no .env
      paysuiteResponse = {
        id: `paysuite_mock_${Date.now()}`,
        reference: order.publicReference,
        amount: amountMzn,
        status: 'pending',
        checkoutUrl: `https://paysuite.tech/checkout/mock_${order.publicReference}`
      };
    }

    const providerRef = paysuiteResponse.id || paysuiteResponse.data?.id || `PS_${order.publicReference}`;

    // Grava registro de pagamento no banco com idempotência
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.PAYSUITE,
        providerReference: providerRef,
        status: PaymentStatus.PENDING,
        amountMinorUnits: order.totalMinorUnits,
        currency: order.currency,
        idempotencyKey: `paysuite_${order.id}_${Date.now()}`,
        providerPayload: paysuiteResponse
      }
    });

    return {
      paymentId: payment.id,
      orderReference: order.publicReference,
      amount: amountMzn,
      currency: order.currency,
      provider: PaymentProvider.PAYSUITE,
      providerReference: providerRef,
      checkoutUrl: paysuiteResponse.checkoutUrl || paysuiteResponse.data?.checkout_url || null,
      status: payment.status
    };
  }

  /**
   * Validação de assinatura criptográfica do Webhook do PaySuite (HMAC-SHA256)
   */
  static verifySignature(rawBody: string | Buffer, signature: string | undefined): boolean {
    if (!this.webhookSecret) {
      // Se não configurado secret em dev, aceita
      return true;
    }

    if (!signature) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const calculated = hmac.update(rawBody).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      return calculated === signature;
    }
  }

  /**
   * Processamento atômico do Webhook do PaySuite
   */
  static async processWebhook(payload: any) {
    const event = payload.event;
    const data = payload.data || payload;

    const externalEventId = data.id || `ps_event_${Date.now()}`;
    const orderPublicReference = data.reference;
    const amountMzn = Number(data.amount) || 0;
    const amountMinorUnits = Math.round(amountMzn * 100);

    const isConfirmed = event === 'payment.success' || data.status === 'completed';

    return await PaymentService.processWebhook({
      provider: PaymentProvider.PAYSUITE,
      externalEventId: String(externalEventId),
      orderPublicReference,
      providerReference: String(data.id || externalEventId),
      amountMinorUnits,
      currency: 'MZN',
      status: isConfirmed ? 'CONFIRMED' : 'FAILED',
      rawPayload: payload
    });
  }
}
