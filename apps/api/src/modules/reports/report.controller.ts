import { Request, Response, NextFunction } from 'express';
import { ReportService } from './report.service';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '@vuka/shared';

export class ReportController {
  static async getSales(req: Request, res: Response, next: NextFunction) {
    try {
      const { publisherId } = req.query;
      const targetPublisherId =
        req.user?.role === UserRole.ADMIN ? (publisherId as string) : req.user?.publisherId || undefined;

      const report = await ReportService.getSalesReport({
        publisherId: targetPublisherId
      });

      return res.status(200).json({ report });
    } catch (error) {
      next(error);
    }
  }

  static async getAuditEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const { publisherId, entityType, limit, offset } = req.query;
      const targetPublisherId =
        req.user?.role === UserRole.ADMIN ? (publisherId as string) : req.user?.publisherId || undefined;

      const result = await AuditService.listEvents({
        publisherId: targetPublisherId,
        entityType: entityType as string,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0
      });

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
