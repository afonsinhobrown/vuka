import { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service';
import { UserRole } from '@vuka/shared';

export class OrderController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { offerId, buyerContact, buyerName, channel, idempotencyKey } = req.body;
      if (!offerId || !buyerContact) {
        return res.status(400).json({
          error: { code: 'MISSING_FIELDS', message: 'Oferta e contacto do comprador são obrigatórios.' }
        });
      }

      const order = await OrderService.createOrder({
        offerId,
        buyerContact,
        buyerName,
        channel,
        userId: req.user?.userId,
        idempotencyKey
      });

      return res.status(201).json({ order });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await OrderService.getOrderByIdOrReference(req.params.id);
      return res.status(200).json({ order });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { publisherId, status, limit, offset } = req.query;
      const targetPublisherId =
        req.user?.role === UserRole.ADMIN ? (publisherId as string) : req.user?.publisherId || undefined;

      const result = await OrderService.listOrders({
        publisherId: targetPublisherId,
        status: status as any,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0
      });

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
