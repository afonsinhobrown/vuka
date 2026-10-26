import { Request, Response, NextFunction } from 'express';
import { ContentService } from './content.service';
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
   */
  static async streamProtectedContent(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const { asset, filePath } = await ContentService.getProtectedContentByToken(token);

      res.setHeader('Content-Type', asset.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${asset.originalName || 'edicao.pdf'}"`);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const stream = fs.createReadStream(filePath);
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

      res.setHeader('Content-Type', result.asset.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24h para capas públicas
      const stream = fs.createReadStream(result.filePath);
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }
}
