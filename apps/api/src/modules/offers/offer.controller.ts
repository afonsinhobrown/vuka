import { Request, Response, NextFunction } from 'express';
import { OfferService } from './offer.service';
import { UserRole } from '@vuka/shared';

export class OfferController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { publisherId, publicationId, status } = req.query;
      const targetPublisherId =
        req.user?.role === UserRole.ADMIN ? (publisherId as string) : req.user?.publisherId || undefined;

      const offers = await OfferService.listOffers({
        publisherId: targetPublisherId,
        publicationId: publicationId as string,
        status: status as any
      });

      return res.status(200).json({ offers });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const offer = await OfferService.getOfferById(req.params.id);
      return res.status(200).json({ offer });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { publisherId, publicationId, editionId, type, title, description, priceMinorUnits, currency, validityDays } =
        req.body;

      const targetPublisherId = req.user?.role === UserRole.ADMIN ? publisherId : req.user?.publisherId;

      if (!type || !title || priceMinorUnits === undefined) {
        return res.status(400).json({
          error: { code: 'MISSING_FIELDS', message: 'Tipo, título e preço são obrigatórios.' }
        });
      }

      const offer = await OfferService.createOffer(req.user!.userId, {
        publisherId: targetPublisherId,
        publicationId,
        editionId,
        type,
        title,
        description,
        priceMinorUnits,
        currency,
        validityDays
      });

      return res.status(201).json({ offer });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const offer = await OfferService.updateOffer(req.user!.userId, req.params.id, req.body);
      return res.status(200).json({ offer });
    } catch (error) {
      next(error);
    }
  }
}
