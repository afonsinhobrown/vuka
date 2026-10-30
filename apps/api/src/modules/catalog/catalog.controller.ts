import { Request, Response, NextFunction } from 'express';
import { CatalogService } from './catalog.service';
import { AssetVisibility, UserRole } from '@vuka/shared';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  buildStorageKey,
  createUploadUrl,
  isAllowedUploadMimeType,
  isRemoteStorageEnabled,
  isValidStorageKey,
  remoteObjectExists
} from '../../lib/storage';

function normaliseMimeType(value: unknown): string {
  return String(value || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

function resolveVisibility(body: Record<string, unknown>): AssetVisibility {
  const isPublic =
    body.visibility === AssetVisibility.PUBLIC ||
    body.isPublic === true ||
    body.isPublic === 'true';
  return isPublic ? AssetVisibility.PUBLIC : AssetVisibility.PRIVATE;
}

export class CatalogController {
  static async getPublicCatalog(req: Request, res: Response, next: NextFunction) {
    try {
      const catalog = await CatalogService.getPublicCatalog();
      return res.status(200).json({ catalog });
    } catch (error) {
      next(error);
    }
  }

  static async getManageableCatalog(req: Request, res: Response, next: NextFunction) {
    try {
      const targetPublisherId =
        req.user?.role === UserRole.ADMIN
          ? ((req.query.publisherId as string) || null)
          : req.user?.publisherId;

      if (req.user?.role !== UserRole.ADMIN && !targetPublisherId) {
        return res.status(403).json({
          error: { code: 'NO_PUBLISHER', message: 'Utilizador sem editora associada.' }
        });
      }

      const catalog = await CatalogService.getPublisherCatalog(targetPublisherId);
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
      const publication = await CatalogService.updatePublication(
        req.user!.userId,
        req.params.id,
        req.body,
        req.user?.publisherId,
        req.user?.role === UserRole.ADMIN
      );
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

      const edition = await CatalogService.createEdition(
        req.user!.userId,
        publicationId,
        {
          title,
          editionDate,
          contentAssetId,
          coverAssetId
        },
        req.user?.publisherId,
        req.user?.role === UserRole.ADMIN
      );

      return res.status(201).json({ edition });
    } catch (error) {
      next(error);
    }
  }

  static async publishEdition(req: Request, res: Response, next: NextFunction) {
    try {
      const edition = await CatalogService.publishEdition(
        req.user!.userId,
        req.params.id,
        req.user?.publisherId,
        req.user?.role === UserRole.ADMIN
      );
      return res.status(200).json({ edition });
    } catch (error) {
      next(error);
    }
  }

  static async withdrawEdition(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      const edition = await CatalogService.withdrawEdition(
        req.user!.userId,
        req.params.id,
        reason,
        req.user?.publisherId,
        req.user?.role === UserRole.ADMIN
      );
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

  /**
   * Passo 1 do upload directo: devolve um URL assinado para o browser enviar o
   * ficheiro para o R2 (evita o limite de 4,5 MB do body das Vercel Functions).
   */
  static async presignUpload(req: Request, res: Response, next: NextFunction) {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const originalName = String(body.filename || body.originalName || '').trim();

      if (!originalName) {
        return res.status(400).json({
          error: { code: 'MISSING_FILENAME', message: 'Nome do ficheiro é obrigatório.' }
        });
      }

      const mimeType = normaliseMimeType(body.mimeType) || 'application/octet-stream';
      if (!isAllowedUploadMimeType(mimeType)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_MIME_TYPE',
            message: `Tipo de ficheiro não suportado. Permitidos: ${ALLOWED_UPLOAD_MIME_TYPES.join(', ')}.`
          }
        });
      }

      const visibility = resolveVisibility(body);

      // Sem R2 configurado → o cliente usa o upload multipart local (dev).
      if (!isRemoteStorageEnabled()) {
        return res.status(200).json({
          storage: 'local',
          maxSizeBytes: MAX_UPLOAD_BYTES
        });
      }

      const storageKey = buildStorageKey(originalName);
      const presigned = createUploadUrl({ storageKey, visibility, mimeType });

      if (!presigned) {
        return res.status(200).json({
          storage: 'local',
          maxSizeBytes: MAX_UPLOAD_BYTES
        });
      }

      return res.status(200).json({
        storage: 'r2',
        visibility,
        storageKey,
        objectKey: presigned.objectKey,
        uploadUrl: presigned.url,
        method: presigned.method,
        headers: { 'Content-Type': mimeType },
        expiresInSeconds: presigned.expiresInSeconds,
        maxSizeBytes: MAX_UPLOAD_BYTES
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Passo 2 do upload directo: confirma que o ficheiro chegou ao R2 e regista o asset.
   */
  static async completeUpload(req: Request, res: Response, next: NextFunction) {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const storageKey = String(body.storageKey || '').trim();

      if (!storageKey || !isValidStorageKey(storageKey)) {
        return res.status(400).json({
          error: { code: 'INVALID_STORAGE_KEY', message: 'storageKey inválida.' }
        });
      }

      const mimeType = normaliseMimeType(body.mimeType);
      if (!isAllowedUploadMimeType(mimeType)) {
        return res.status(400).json({
          error: { code: 'INVALID_MIME_TYPE', message: 'Tipo de ficheiro não suportado.' }
        });
      }

      const sizeBytes = Math.round(Number(body.sizeBytes));
      if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
        return res.status(400).json({
          error: {
            code: 'INVALID_SIZE',
            message: `Tamanho inválido. Máximo permitido: ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`
          }
        });
      }

      const visibility = resolveVisibility(body);

      const exists = await remoteObjectExists({ storageKey, visibility });
      if (!exists) {
        return res.status(400).json({
          error: {
            code: 'UPLOAD_NOT_FOUND',
            message: 'O ficheiro não foi encontrado no armazenamento. Repita o envio.'
          }
        });
      }

      const asset = await CatalogService.registerAsset(
        String(body.originalName || body.filename || storageKey).trim(),
        mimeType,
        sizeBytes,
        storageKey,
        visibility
      );

      return res.status(201).json({ asset });
    } catch (error) {
      next(error);
    }
  }
}
