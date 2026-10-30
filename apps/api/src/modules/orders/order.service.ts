import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error.middleware';
import { OrderStatus, OfferStatus, OrderDTO } from '@vuka/shared';
import { AuditService } from '../audit/audit.service';
import { SubscriptionService } from '../subscriptions/subscription.service';
import crypto from 'crypto';

function generatePublicReference(): string {
  // Format: VUKA-XXXXXX (6 alphanumeric chars)
  const randomChars = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VUKA-${randomChars}`;
}

export class OrderService {
  static async createOrder(data: {
    offerId: string;
    buyerContact: string;
    buyerName?: string;
    channel?: string;
    userId?: string;
    idempotencyKey?: string;
  }): Promise<OrderDTO> {
    const { offerId, buyerContact, buyerName, channel = 'whatsapp', userId, idempotencyKey } = data;

    // Idempotency check: if order exists with same idempotencyKey, return it
    if (idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey },
        include: { offer: true }
      });
      if (existing) {
        return this.formatOrder(existing);
      }
    }

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        publisher: true,
        publication: true,
        edition: true
      }
    });

    if (!offer || offer.status !== OfferStatus.ACTIVE) {
      throw new AppError('Oferta não disponível ou inativa.', 404, 'OFFER_UNAVAILABLE');
    }

    // Limite de vendas do plano do jornal
    if (offer.publisherId) {
      await SubscriptionService.assertCanSell(offer.publisherId);
    }

    // Freeze snapshot of the offer
    const offerSnapshot = {
      offerId: offer.id,
      title: offer.title,
      type: offer.type,
      priceMinorUnits: offer.priceMinorUnits,
      currency: offer.currency,
      validityDays: offer.validityDays,
      publisherId: offer.publisherId,
      publisherName: offer.publisher?.name,
      publicationId: offer.publicationId,
      publicationTitle: offer.publication?.title,
      editionId: offer.editionId,
      editionTitle: offer.edition?.title
    };

    // Expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const publicReference = generatePublicReference();

    const order = await prisma.order.create({
      data: {
        publicReference,
        userId: userId || null,
        offerId: offer.id,
        buyerContact: buyerContact.trim(),
        buyerName: buyerName?.trim() || null,
        channel,
        status: OrderStatus.PENDING_PAYMENT,
        currency: offer.currency,
        totalMinorUnits: offer.priceMinorUnits,
        offerSnapshot,
        idempotencyKey: idempotencyKey || null,
        expiresAt
      },
      include: { offer: true }
    });

    await AuditService.record({
      actorUserId: userId || null,
      publisherId: offer.publisherId,
      action: 'CREATE',
      entityType: 'ORDER',
      entityId: order.id,
      reason: `Criação de pedido ${order.publicReference} para a oferta ${offer.title}`
    });

    return this.formatOrder(order);
  }

  static async getOrderByIdOrReference(idOrRef: string): Promise<OrderDTO> {
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: idOrRef }, { publicReference: idOrRef }]
      },
      include: { offer: true }
    });

    if (!order) {
      throw new AppError('Pedido não encontrado.', 404, 'ORDER_NOT_FOUND');
    }

    return this.formatOrder(order);
  }

  static async listOrders(options: {
    publisherId?: string;
    userId?: string;
    status?: OrderStatus;
    limit?: number;
    offset?: number;
  }) {
    const { publisherId, userId, status, limit = 50, offset = 0 } = options;
    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (publisherId) {
      where.offer = { publisherId };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          offer: {
            include: { publisher: true }
          },
          payments: true
        }
      }),
      prisma.order.count({ where })
    ]);

    return {
      orders: orders.map((o: any) => this.formatOrder(o)),
      total
    };
  }

  private static formatOrder(order: any): OrderDTO {
    return {
      id: order.id,
      publicReference: order.publicReference,
      userId: order.userId,
      offerId: order.offerId,
      offerTitle: (order.offerSnapshot as any)?.title || order.offer?.title || 'Oferta VUKA',
      buyerContact: order.buyerContact,
      status: order.status as OrderStatus,
      currency: order.currency,
      totalMinorUnits: order.totalMinorUnits,
      offerSnapshot: order.offerSnapshot as Record<string, any>,
      expiresAt: order.expiresAt.toISOString(),
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt ? order.paidAt.toISOString() : null
    };
  }
}
