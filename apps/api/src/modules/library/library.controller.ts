import { Request, Response, NextFunction } from 'express';
import { EntitlementService } from '../entitlements/entitlement.service';

export class LibraryController {
  static async getMyLibrary(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await EntitlementService.getUserLibrary(req.user!.userId);
      return res.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  }
}
