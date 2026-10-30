import { Request, Response, NextFunction } from 'express';
import { ContentService } from './content.service';
import { AppError } from '../../middlewares/error.middleware';
import {
  DOWNLOAD_URL_TTL_SECONDS,
  createDownloadUrl,
  isRemoteStorageEnabled,
  sanitizeFilename
} from '../../lib/storage';
import fs from 'fs';

export class ContentController {
  /**
   * Pedido de autorização e link de streaming para uma edição: GET /api/v1/editions/:id/access
   */
  static async requestAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const accessData = await ContentService.requestEditionAccess(req.user!.userId, req.params.id);
      return res.status(200).json(accessData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Streaming seguro de PDF com token assinado: GET /api/v1/content/stream/:token
   *
   * Com R2 configurado devolvemos um 302 para um URL assinado (5 min) em vez de
   * fazer proxy dos bytes pela Function — o browser/iframe segue o redirect e o
   * ficheiro sai directo do Cloudflare (egress grátis, sem custo de CPU).
   */
  static async streamProtectedContent(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const { asset, filePath } = await ContentService.getProtectedContentByToken(token);

      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      if (!filePath) {
        const signed = createDownloadUrl({
          storageKey: asset.storageKey,
          visibility: asset.visibility,
          filename: asset.originalName || 'edicao.pdf',
          inline: true,
          expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS
        });

        if (!signed) {
          throw new AppError('Armazenamento de conteúdo indisponível.', 503, 'STORAGE_UNAVAILABLE');
        }

        return res.redirect(302, signed.url);
      }

      res.setHeader('Content-Type', asset.mimeType || 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${sanitizeFilename(asset.originalName) || 'edicao.pdf'}"`
      );

      const stream = fs.createReadStream(filePath);
      stream.on('error', (error) => next(error));
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Entrega de assets públicos (capas de edições e jornais): GET /api/v1/assets/:id
   */
  static async servePublicAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ContentService.getAssetFile(req.params.id);
      if (!result) {
        return res.status(404).json({ error: { code: 'ASSET_NOT_FOUND', message: 'Ficheiro não encontrado.' } });
      }

      if (result.asset.visibility === 'PRIVATE') {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Ficheiro protegido. É necessário link assinado de leitura.' }
        });
      }

      if (!result.filePath) {
        const signed = createDownloadUrl({
          storageKey: result.asset.storageKey,
          visibility: result.asset.visibility,
          inline: true,
          expiresInSeconds: 3600
        });

        if (!signed) {
          throw new AppError('Armazenamento de conteúdo indisponível.', 503, 'STORAGE_UNAVAILABLE');
        }

        // 30 min de cache no CDN: o URL assinado vale 1h.
        res.setHeader('Cache-Control', 'public, max-age=1800');
        return res.redirect(302, signed.url);
      }

      res.setHeader('Content-Type', result.asset.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24h para capas públicas

      const stream = fs.createReadStream(result.filePath);
      stream.on('error', (error) => next(error));
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Diagnóstico de storage (útil para confirmar a configuração na Vercel).
   */
  static async storageStatus(req: Request, res: Response) {
    return res.status(200).json({
      provider: isRemoteStorageEnabled() ? 'r2' : 'local'
    });
  }
}
