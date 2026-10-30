import { Request, Response, NextFunction } from 'express';
import { PublisherService } from './publisher.service';
import { SubscriptionService, SubscriptionStatus } from '../subscriptions/subscription.service';
import { SubscriptionInvoiceService } from '../subscriptions/invoice.service';
import { UserRole } from '@vuka/shared';

export class PublisherController {
  /* ---------------- Facturas de subscrição ---------------- */

  /** Facturas do próprio jornal. */
  static async listMyInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const publisherId = req.user?.publisherId;
      if (!publisherId) {
        return res.status(403).json({
          error: { code: 'NO_PUBLISHER', message: 'Utilizador sem editora associada.' }
        });
      }
      const invoices = await SubscriptionInvoiceService.list(publisherId);
      return res.status(200).json({ invoices });
    } catch (error) {
      next(error);
    }
  }

  static async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const invoices = await SubscriptionInvoiceService.list(req.params.id);
      return res.status(200).json({ invoices });
    } catch (error) {
      next(error);
    }
  }

  /** Cria a factura do próximo ciclo e pede a cobrança à PaySuite (ADMIN). */
  static async createInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await SubscriptionInvoiceService.create(req.params.id, req.user!.userId);
      return res.status(201).json({ invoice });
    } catch (error) {
      next(error);
    }
  }

  /** Marca a factura como paga (pagamento por fora / confirmação manual). */
  static async markInvoicePaid(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await SubscriptionInvoiceService.markPaid(req.params.id, req.user!.userId);
      return res.status(200).json({ invoice });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rotina de renovação (cron diário ou admin): cria factura para os jornais
   * cuja renovação venceu e ainda não têm factura pendente.
   */
  static async runRenewals(req: Request, res: Response, next: NextFunction) {
    try {
      const cronSecret = process.env.CRON_SECRET;
      const authorization = req.headers.authorization || '';
      const isCron = Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`;
      const isAdmin = req.user?.role === UserRole.ADMIN;

      if (!isCron && !isAdmin) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Rotina de renovação restrita ao cron ou ao administrador.' }
        });
      }

      const result = await SubscriptionInvoiceService.runRenewals();
      return res.status(200).json({ renewals: result });
    } catch (error) {
      next(error);
    }
  }

  /** Tabela de preços (público). */
  static async listPlans(_req: Request, res: Response, next: NextFunction) {
    try {
      return res.status(200).json({ plans: SubscriptionService.listPlans() });
    } catch (error) {
      next(error);
    }
  }

  /** Plano + consumo do próprio jornal. */
  static async getMySubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const publisherId = req.user?.publisherId;
      if (!publisherId) {
        return res.status(403).json({
          error: { code: 'NO_PUBLISHER', message: 'Utilizador sem editora associada.' }
        });
      }

      const subscription = await SubscriptionService.getOverview(publisherId);
      return res.status(200).json({ subscription });
    } catch (error) {
      next(error);
    }
  }

  /** Subscrição de uma editora (ADMIN). */
  static async getSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const subscription = await SubscriptionService.getOverview(req.params.id);
      return res.status(200).json({ subscription });
    } catch (error) {
      next(error);
    }
  }

  /** Alterar plano / estado / renovação (ADMIN). */
  static async updateSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const { planCode, status, renewsAt } = req.body || {};
      const subscription = await SubscriptionService.changePlan(req.user!.userId, req.params.id, {
        planCode,
        status: status as SubscriptionStatus,
        renewsAt
      });
      return res.status(200).json({ subscription });
    } catch (error) {
      next(error);
    }
  }

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
