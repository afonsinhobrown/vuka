import * as crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error.middleware';
import { PaymentProvider, PaymentStatus, OrderStatus } from '@vuka/shared';
import { PaymentService } from './payment.service';
import { DEFAULT_SANDBOX_AMOUNT_MINOR_UNITS, resolveSandboxState } from '../../lib/sandbox-payments';

const PAYSUITE_API_URL = (
  process.env.PAYSUITE_API_URL || 'https://paysuite.tech/api/v1'
).replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 15000;
const CODIGO_PAIS = '258';

export type PaySuiteMethod = 'mpesa' | 'emola' | 'credit_card';

export type PaySuiteChargeResult = {
  id: string;
  status: string;
  amount: number;
  reference: string;
  method?: string;
  checkoutUrl?: string;
};

export class PaySuiteApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PaySuiteApiError';
    this.status = status;
  }
}

function apiToken(): string | null {
  return process.env.PAYSUITE_API_TOKEN || process.env.PAYSUITE_API_KEY || null;
}

function webhookSecret(): string | null {
  return process.env.PAYSUITE_WEBHOOK_SECRET || null;
}

export type PaySuiteConfigStatus = {
  provider: 'paysuite';
  configured: boolean;
  apiUrl: string;
  tokenPresent: boolean;
  webhookSecretPresent: boolean;
  baseUrl: string;
  webhookUrl: string;
  baseUrlLooksLikeLocalhost: boolean;
  sandboxMode: boolean;
  sandboxSource: 'settings' | 'env';
  /** Valor fixo cobrado pela PaySuite em sandbox (minor units). */
  sandboxFixedAmountMinorUnits: number;
  missing: string[];
};

/**
 * Diagnóstico sem expor segredos: diz apenas o que está (ou não) configurado.
 * AJUDA: BASE_URL é o que a PaySuite usa para chamar o webhook — se apontar para
 * localhost, o pagamento nunca confirma o pedido.
 */
export async function getPaySuiteConfigStatus(): Promise<PaySuiteConfigStatus> {
  const token = apiToken();
  const secret = webhookSecret();
  const baseUrl = (process.env.BASE_URL || '').trim().replace(/\/+$/, '');
  const baseUrlLooksLikeLocalhost = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(baseUrl);
  const sandbox = await resolveSandboxState();

  const missing: string[] = [];
  if (!token) missing.push('PAYSUITE_API_TOKEN');
  if (!secret) missing.push('PAYSUITE_WEBHOOK_SECRET');
  if (!baseUrl) missing.push('BASE_URL');
  else if (baseUrlLooksLikeLocalhost) missing.push('BASE_URL (aponta para localhost em vez do domínio público)');

  return {
    provider: 'paysuite',
    configured: missing.length === 0,
    apiUrl: PAYSUITE_API_URL,
    tokenPresent: Boolean(token),
    webhookSecretPresent: Boolean(secret),
    baseUrl,
    webhookUrl: `${baseUrl || '<BASE_URL em falta>'}/api/v1/payments/webhook/paysuite`,
    baseUrlLooksLikeLocalhost,
    sandboxMode: sandbox.enabled,
    sandboxSource: sandbox.source,
    sandboxFixedAmountMinorUnits: sandbox.amountMinorUnits ?? DEFAULT_SANDBOX_AMOUNT_MINOR_UNITS,
    missing
  };
}

export function normalizarTelefoneE164(telefone: string | number | null | undefined): string | null {
  let digitos = String(telefone ?? '').replace(/\D/g, '');
  if (digitos.startsWith(CODIGO_PAIS) && digitos.length === 12) {
    digitos = digitos.slice(CODIGO_PAIS.length);
  }
  if (digitos.length !== 9) return null;
  return `+${CODIGO_PAIS}${digitos}`;
}

function toNumber(val: unknown, fallback: number): number {
  const n = typeof val === 'number' ? val : parseFloat(String(val ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

async function paysuiteRequest<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown }
): Promise<T> {
  const token = apiToken();
  if (!token) {
    throw new AppError('Credenciais da PaySuite em falta (PAYSUITE_API_TOKEN).', 500, 'PAYSUITE_CONFIG_MISSING');
  }

  const response = await fetch(`${PAYSUITE_API_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  const raw = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const errors = parsed?.errors;
    const detalhe =
      errors && typeof errors === 'object'
        ? Object.values(errors as Record<string, unknown>).map(String).join('; ')
        : '';
    const message =
      (parsed && typeof parsed.message === 'string' && parsed.message) ||
      (parsed && typeof parsed.error === 'string' && parsed.error) ||
      `PaySuite respondeu com estado ${response.status}`;
    throw new PaySuiteApiError(detalhe ? `${message} (${detalhe})` : message, response.status);
  }

  return (parsed?.data ?? parsed ?? {}) as T;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

function tryHex(key: string, message: string, provided: string): boolean {
  const expected = crypto.createHmac('sha256', key).update(message, 'utf8').digest('hex');
  return safeEqual(provided.toLowerCase(), expected.toLowerCase());
}

function tryBase64(key: string, message: string, provided: string): boolean {
  const expected = crypto.createHmac('sha256', key).update(message, 'utf8').digest('base64');
  return safeEqual(provided.trim(), expected);
}

/**
 * Validação idêntica à do Doremi: suporta formatos hex, base64 e timestamp (t=...;v1=...)
 */
export function verifyPaySuiteWebhookSignature(
  rawBody: string,
  signature: string | null | undefined
): boolean {
  const secret = webhookSecret();
  if (!secret) {
    // Em desenvolvimento sem secret configurado, aceita
    return true;
  }
  if (!signature) return false;

  const provided = signature
    .replace(/^t=\d+(\.\d+)?\s*[;,]\s*v1=/i, '')
    .replace(/^v1=/i, '')
    .replace(/^sha256=/i, '')
    .replace(/^hmac\s+sha256=/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
  if (!provided) return false;

  try {
    const keys = [secret, secret.trim()];

    for (const key of keys) {
      if (tryHex(key, rawBody, provided) || tryBase64(key, rawBody, provided)) return true;
    }

    const ts = signature.match(/t=(\d+)/);
    if (ts) {
      const signed = `${ts[1]}.${rawBody}`;
      for (const key of keys) {
        if (tryHex(key, signed, provided) || tryBase64(key, signed, provided)) return true;
      }
    }

    console.warn(
      'PaySuite Webhook: assinatura inválida. ' +
        `sigPreview=${JSON.stringify(provided.slice(0, 24))} sigLen=${provided.length} ` +
        `bodyLen=${rawBody.length} secretLen=${secret.length}`
    );
    return false;
  } catch (err) {
    console.error('Erro ao validar assinatura do webhook PaySuite:', err);
    return false;
  }
}

export class PaySuiteService {
  /**
   * Procura ou cria contacto no PaySuite pelo telefone
   */
  static async findOrCreateContact(params: {
    name?: string | null;
    phone: string | number | null | undefined;
    email?: string | null;
  }): Promise<string | null> {
    const phone = normalizarTelefoneE164(params.phone);
    if (!phone) return null;

    try {
      const existentes = await paysuiteRequest<unknown[]>('/contacts?limit=100', {
        method: 'GET'
      });
      if (Array.isArray(existentes)) {
        const achado = existentes.find(
          (c) =>
            c &&
            typeof c === 'object' &&
            normalizarTelefoneE164((c as Record<string, unknown>).phone as string) === phone
        );
        const id = achado && (achado as Record<string, unknown>).id;
        if (id) return String(id);
      }
    } catch {
      // segue para criar
    }

    try {
      const body: Record<string, unknown> = { phone };
      if (params.name?.trim()) body.name = params.name.trim().slice(0, 100);
      if (params.email?.trim()) body.email = params.email.trim().slice(0, 100);

      const contact = await paysuiteRequest<Record<string, unknown>>('/contacts', {
        method: 'POST',
        body
      });
      return contact.id ? String(contact.id) : null;
    } catch {
      return null;
    }
  }

  /**
   * Cria uma cobrança idêntica ao padrão de produção do Doremi
   */
  static async createPayment(data: {
    orderId: string;
    method?: PaySuiteMethod;
    phoneNumber?: string;
    returnUrl?: string;
  }) {
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { user: true }
    });

    if (!order) {
      throw new AppError('Pedido não encontrado.', 404, 'ORDER_NOT_FOUND');
    }

    if (order.status === OrderStatus.PAID) {
      throw new AppError('Este pedido já foi pago.', 400, 'ORDER_ALREADY_PAID');
    }

    const amountMzn = Number((order.totalMinorUnits / 100).toFixed(2));

  const phone = data.phoneNumber || order.buyerContact || order.user?.phone;
  const contactId = phone
    ? await this.findOrCreateContact({
        phone,
        name: order.buyerName || order.user?.displayName,
        email: order.user?.email
      })
    : null;

  const payload: Record<string, unknown> = {
    amount: amountMzn,
    reference: order.publicReference.slice(0, 50),
    description: `VUKA ${order.publicReference}`.slice(0, 125)
  };

  if (data.method) payload.method = data.method;
  if (contactId) payload.contact_id = contactId;
  if (data.returnUrl) payload.return_url = data.returnUrl;

  // Webhook automático para este pedido
  const baseApiUrl = process.env.BASE_URL || 'http://localhost:4000';
  payload.webhook_url = `${baseApiUrl}/api/v1/payments/webhook/paysuite`;

  const charge = await paysuiteRequest<Record<string, unknown>>('/payments', {
    method: 'POST',
    body: payload
  });

  const chargeResult: PaySuiteChargeResult = {
    id: String(charge.id ?? ''),
    status: String(charge.status || 'pending').toLowerCase(),
    amount: toNumber(charge.amount, amountMzn),
    reference: String(charge.reference || order.publicReference),
    method: charge.method ? String(charge.method) : data.method,
    checkoutUrl:
      typeof charge.checkout_url === 'string' && charge.checkout_url
        ? charge.checkout_url
        : undefined
  };

    // Grava o pagamento na base de dados com idempotência
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.PAYSUITE,
        providerReference: chargeResult.id,
        status: PaymentStatus.PENDING,
        amountMinorUnits: order.totalMinorUnits,
        currency: order.currency,
        idempotencyKey: `paysuite_${order.id}_${Date.now()}`,
        providerPayload: chargeResult as any
      }
    });

    return {
      paymentId: payment.id,
      orderReference: order.publicReference,
      amount: amountMzn,
      currency: order.currency,
      provider: PaymentProvider.PAYSUITE,
      providerReference: chargeResult.id,
      checkoutUrl: chargeResult.checkoutUrl,
      status: payment.status
    };
  }

  /**
   * Processa o Webhook no mesmo formato e regras do Doremi
   */
  static async processWebhook(payload: any) {
    const event = String(payload.event || '').toLowerCase();
    const data = payload.data || payload;

    const reference = String(data.reference || '');
    const externalId = String(data.id || `ps_${Date.now()}`);
    const amountMzn = toNumber(data.amount, 0);
    const amountMinorUnits = Math.round(amountMzn * 100);

    const isPaid =
      event === 'payment.success' ||
      event === 'payment.succeeded' ||
      event === 'payment.paid' ||
      ['paid', 'succeeded', 'completed'].includes(String(data.status || '').toLowerCase());

    const isFailed =
      event === 'payment.failed' ||
      event === 'payment.cancelled' ||
      ['failed', 'cancelled', 'canceled', 'expired', 'declined', 'rejected'].includes(
        String(data.status || '').toLowerCase()
      );

    return await PaymentService.processWebhook({
      provider: PaymentProvider.PAYSUITE,
      externalEventId: externalId,
      orderPublicReference: reference,
      providerReference: externalId,
      amountMinorUnits,
      currency: 'MZN',
      status: isPaid ? 'CONFIRMED' : isFailed ? 'FAILED' : 'FAILED',
      rawPayload: payload
    });
  }
}
