import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error.middleware';
import { EntitlementService } from '../entitlements/entitlement.service';
import { createSignedContentToken, verifySignedContentToken } from '../../lib/crypto';
import { SecureReadAccessDTO } from '@vuka/shared';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = process.env.STORAGE_DIR || './storage';

export class ContentService {
  /**
   * Solicitação de leitura de uma edição (RF-09, CA-06)
   */
  static async requestEditionAccess(userId: string, editionId: string): Promise<SecureReadAccessDTO> {
    const edition = await prisma.edition.findUnique({
      where: { id: editionId }
    });

    if (!edition) {
      throw new AppError('Edição não encontrada.', 404, 'EDITION_NOT_FOUND');
    }

    // 1. Validação estrita de direito de acesso (Entitlement)
    const hasAccess = await EntitlementService.hasActiveAccessToEdition(userId, editionId);

    if (!hasAccess) {
      throw new AppError(
        'Acesso não autorizado. Não possui direito ativo ou a sua assinatura expirou.',
        403,
        'NO_ACTIVE_ENTITLEMENT'
      );
    }

    // 2. Geração de Token Assinado de Curta Duração (300 segundos / 5 minutos)
    const token = createSignedContentToken(userId, edition.id, edition.contentAssetId, 300);

    return {
      editionId: edition.id,
      title: edition.title,
      readUrl: `/api/v1/content/stream/${token}`,
      expiresInSeconds: 300
    };
  }

  /**
   * Localiza ficheiro do asset e valida visibilidade
   */
  static async getAssetFile(assetId: string) {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return null;

    const subfolder = asset.visibility === 'PUBLIC' ? 'public' : 'private';
    const filePath = path.join(STORAGE_DIR, subfolder, asset.storageKey);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    return { asset, filePath };
  }

  /**
   * Valida token assinado e retorna caminho do ficheiro seguro
   */
  static async getProtectedContentByToken(token: string) {
    const payload = verifySignedContentToken(token);
    if (!payload) {
      throw new AppError('Link de leitura inválido ou expirado. Por favor atualize a sua biblioteca.', 403, 'TOKEN_EXPIRED_OR_INVALID');
    }

    const asset = await prisma.asset.findUnique({
      where: { id: payload.contentAssetId }
    });

    if (!asset) {
      throw new AppError('Conteúdo não localizado.', 404, 'CONTENT_NOT_FOUND');
    }

    const filePath = path.join(STORAGE_DIR, 'private', asset.storageKey);
    if (!fs.existsSync(filePath)) {
      throw new AppError('Ficheiro de conteúdo não encontrado no armazenamento.', 404, 'FILE_NOT_FOUND');
    }

    return { asset, filePath };
  }
}
