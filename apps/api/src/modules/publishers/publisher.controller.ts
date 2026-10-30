import { Request, Response, NextFunction } from 'express';
import { PublisherService } from './publisher.service';
import { UserRole } from '@vuka/shared';

export class PublisherController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const publishers = await PublisherService.listPublishers(req.user?.role, req.user?.publisherId);
      return res.status(200).json({ publishers });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const publisher = await PublisherService.getPublisherById(req.params.id);
      return res.status(200).json({ publisher });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, slug, contactEmail, contactPhone } = req.body;
      if (!name || !slug) {
        return res.status(400).json({
          error: { code: 'MISSING_FIELDS', message: 'Nome e slug são obrigatórios.' }
        });
      }

      const publisher = await PublisherService.createPublisher(req.user!.userId, {
        name,
        slug,
        contactEmail,
        contactPhone
      });

      return res.status(201).json({ publisher });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Auto-registo público de um jornal (requer código de convite).
   */
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        publisherName,
        name,
        slug,
        contactEmail,
        contactPhone,
        adminName,
        adminEmail,
        email,
        adminPhone,
        phone,
        password,
        inviteCode
      } = req.body || {};

      const result = await PublisherService.registerPublisher({
        publisherName: publisherName || name,
        slug,
        contactEmail,
        contactPhone,
        adminName,
        adminEmail: adminEmail || email,
        adminPhone: adminPhone || phone,
        password,
        inviteCode
      });

      return res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /* ---------------- Códigos de convite (ADMIN) ---------------- */

  static async listInvites(_req: Request, res: Response, next: NextFunction) {
    try {
      const invites = await PublisherService.listInvites();
      return res.status(200).json({ invites });
    } catch (error) {
      next(error);
    }
  }

  static async createInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const { note, expiresInDays } = req.body || {};
      const invite = await PublisherService.createInvite(req.user!.userId, { note, expiresInDays });
      return res.status(201).json({ invite });
    } catch (error) {
      next(error);
    }
  }

  static async revokeInvite(req: Request, res: Response, next: NextFunction) {
    try {
      await PublisherService.revokeInvite(req.user!.userId, req.params.id);
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const publisher = await PublisherService.updatePublisher(req.user!.userId, req.params.id, req.body);
      return res.status(200).json({ publisher });
    } catch (error) {
      next(error);
    }
  }

  static async listMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await PublisherService.listMembers(req.params.id);
      return res.status(200).json({ members });
    } catch (error) {
      next(error);
    }
  }
}
