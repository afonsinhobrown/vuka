import { Request, Response, NextFunction } from 'express';
import { CatalogService } from './catalog.service';
import { AssetVisibility, UserRole } from '@vuka/shared';
import path from 'path';

export class CatalogController {
  static async getPublicCatalog(req: Request, res: Response, next: NextFunction) {
    try {
      const catalog = await CatalogService.getPublicCatalog();
      return res.status(200).json({ catalog });
    } catch (error) {
      next(error);
    }
  }

  static async getPublicationById(req: Request, res: Response, next: NextFunction) {
    try {
      const includeDrafts = req.query.includeDrafts === 'true';
      const publication = await CatalogService.getPublicationById(
        req.params.id,
        includeDrafts,
        req.user?.publisherId
      );
      return res.status(200).json({ publication });
    } catch (error) {
      next(error);
    }
  }

  static async createPublication(req: Request, res: Response, next: NextFunction) {
    try {
      const { publisherId, title, slug, description, coverAssetId } = req.body;
      const targetPublisherId = req.user?.role === UserRole.ADMIN ? publisherId : req.user?.publisherId;

      if (!targetPublisherId || !title || !slug) {
        return res.status(400).json({
          error: { code: 'MISSING_FIELDS', message: 'Editora, título e slug são obrigatórios.' }
        });
      }

      const publication = await CatalogService.createPublication(req.user!.userId, targetPublisherId, {
        title,
        slug,
        description,
        coverAssetId
      });

      return res.status(201).json({ publication });
    } catch (error) {
      next(error);
    }
  }

  static async updatePublication(req: Request, res: Response, next: NextFunction) {
    try {
      const publication = await CatalogService.updatePublication(req.user!.userId, req.params.id, req.body);
      return res.status(200).json({ publication });
    } catch (error) {
      next(error);
    }
  }

  static async createEdition(req: Request, res: Response, next: NextFunction) {
    try {
      const { publicationId, title, editionDate, contentAssetId, coverAssetId } = req.body;
      if (!publicationId || !title || !editionDate || !contentAssetId) {
        return res.status(400).json({
          error: { code: 'MISSING_FIELDS', message: 'Campos da edição incompletos.' }
        });
      }

      const edition = await CatalogService.createEdition(req.user!.userId, publicationId, {
        title,
        editionDate,
        contentAssetId,
        coverAssetId
      });

      return res.status(201).json({ edition });
    } catch (error) {
      next(error);
    }
  }

  static async publishEdition(req: Request, res: Response, next: NextFunction) {
    try {
      const edition = await CatalogService.publishEdition(req.user!.userId, req.params.id);
      return res.status(200).json({ edition });
    } catch (error) {
      next(error);
    }
  }

  static async withdrawEdition(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      const edition = await CatalogService.withdrawEdition(req.user!.userId, req.params.id, reason);
      return res.status(200).json({ edition });
    } catch (error) {
      next(error);
    }
  }

  static async uploadAsset(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: { code: 'NO_FILE', message: 'Nenhum ficheiro enviado.' }
        });
      }

      const isPublic = req.body.isPublic === 'true' || req.file.mimetype.startsWith('image/');
      const visibility = isPublic ? AssetVisibility.PUBLIC : AssetVisibility.PRIVATE;

      const asset = await CatalogService.registerAsset(
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.filename,
        visibility
      );

      return res.status(201).json({ asset });
    } catch (error) {
      next(error);
    }
  }
}
