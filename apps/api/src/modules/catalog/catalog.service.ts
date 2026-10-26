import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error.middleware';
import {
  PublicationStatus,
  EditionStatus,
  AssetVisibility,
  PublicationDTO,
  EditionDTO,
  UserRole
} from '@vuka/shared';
import { AuditService } from '../audit/audit.service';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = process.env.STORAGE_DIR || './storage';

// Ensure storage subfolders exist
if (!fs.existsSync(path.join(STORAGE_DIR, 'public'))) {
  fs.mkdirSync(path.join(STORAGE_DIR, 'public'), { recursive: true });
}
if (!fs.existsSync(path.join(STORAGE_DIR, 'private'))) {
  fs.mkdirSync(path.join(STORAGE_DIR, 'private'), { recursive: true });
}

export class CatalogService {
  /**
   * Catálogo público com publicações ativas e ofertas
   */
  static async getPublicCatalog() {
    const publications = await prisma.publication.findMany({
      where: { status: PublicationStatus.ACTIVE },
      include: {
        publisher: { select: { id: true, name: true } },
        editions: {
          where: { status: EditionStatus.PUBLISHED },
          orderBy: { editionDate: 'desc' },
          take: 5
        },
        offers: {
          where: { status: 'ACTIVE' },
          orderBy: { priceMinorUnits: 'asc' }
        }
      },
      orderBy: { title: 'asc' }
    });

    return publications.map((p) => ({
      id: p.id,
      publisherId: p.publisherId,
      publisherName: p.publisher.name,
      title: p.title,
      slug: p.slug,
      description: p.description,
      coverAssetId: p.coverAssetId,
      coverUrl: p.coverAssetId ? `/api/v1/assets/${p.coverAssetId}` : null,
      status: p.status,
      latestEditions: p.editions.map((e) => ({
        id: e.id,
        title: e.title,
        editionDate: e.editionDate.toISOString().split('T')[0],
        coverUrl: e.coverAssetId ? `/api/v1/assets/${e.coverAssetId}` : null
      })),
      offers: p.offers.map((o) => ({
        id: o.id,
        type: o.type,
        title: o.title,
        priceMinorUnits: o.priceMinorUnits,
        currency: o.currency,
        validityDays: o.validityDays
      }))
    }));
  }

  static async getPublicationById(id: string, includeDrafts = false, userPublisherId?: string | null) {
    const publication = await prisma.publication.findUnique({
      where: { id },
      include: {
        publisher: { select: { id: true, name: true } },
        editions: {
          where: includeDrafts ? {} : { status: EditionStatus.PUBLISHED },
          orderBy: { editionDate: 'desc' }
        },
        offers: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    if (!publication) {
      throw new AppError('Publicação não encontrada.', 404, 'PUBLICATION_NOT_FOUND');
    }

    if (includeDrafts && userPublisherId && publication.publisherId !== userPublisherId) {
      throw new AppError('Acesso não autorizado aos rascunhos desta publicação.', 403, 'FORBIDDEN');
    }

    return {
      id: publication.id,
      publisherId: publication.publisherId,
      publisherName: publication.publisher.name,
      title: publication.title,
      slug: publication.slug,
      description: publication.description,
      coverAssetId: publication.coverAssetId,
      coverUrl: publication.coverAssetId ? `/api/v1/assets/${publication.coverAssetId}` : null,
      status: publication.status,
      editions: publication.editions.map((e) => ({
        id: e.id,
        publicationId: e.publicationId,
        title: e.title,
        editionDate: e.editionDate.toISOString().split('T')[0],
        contentAssetId: e.contentAssetId,
        coverAssetId: e.coverAssetId,
        coverUrl: e.coverAssetId ? `/api/v1/assets/${e.coverAssetId}` : null,
        status: e.status,
        publishedAt: e.publishedAt ? e.publishedAt.toISOString() : null,
        createdAt: e.createdAt.toISOString()
      })),
      offers: publication.offers
    };
  }

  static async createPublication(
    actorUserId: string,
    publisherId: string,
    data: { title: string; slug: string; description?: string; coverAssetId?: string }
  ): Promise<PublicationDTO> {
    const pub = await prisma.publication.create({
      data: {
        publisherId,
        title: data.title.trim(),
        slug: data.slug.toLowerCase().trim(),
        description: data.description?.trim(),
        coverAssetId: data.coverAssetId || null,
        status: PublicationStatus.ACTIVE
      },
      include: { publisher: true }
    });

    await AuditService.record({
      actorUserId,
      publisherId,
      action: 'CREATE',
      entityType: 'PUBLICATION',
      entityId: pub.id,
      reason: `Criação da publicação ${pub.title}`
    });

    return {
      id: pub.id,
      publisherId: pub.publisherId,
      publisherName: pub.publisher.name,
      title: pub.title,
      slug: pub.slug,
      description: pub.description,
      coverAssetId: pub.coverAssetId,
      coverUrl: pub.coverAssetId ? `/api/v1/assets/${pub.coverAssetId}` : null,
      status: pub.status as PublicationStatus,
      createdAt: pub.createdAt.toISOString(),
      updatedAt: pub.updatedAt.toISOString()
    };
  }

  static async updatePublication(
    actorUserId: string,
    id: string,
    data: { title?: string; description?: string; coverAssetId?: string; status?: PublicationStatus }
  ) {
    const pub = await prisma.publication.findUnique({ where: { id } });
    if (!pub) throw new AppError('Publicação não encontrada.', 404, 'NOT_FOUND');

    const updated = await prisma.publication.update({
      where: { id },
      data: {
        title: data.title !== undefined ? data.title.trim() : undefined,
        description: data.description !== undefined ? data.description.trim() : undefined,
        coverAssetId: data.coverAssetId !== undefined ? data.coverAssetId : undefined,
        status: data.status !== undefined ? data.status : undefined
      }
    });

    await AuditService.record({
      actorUserId,
      publisherId: pub.publisherId,
      action: 'UPDATE',
      entityType: 'PUBLICATION',
      entityId: id,
      reason: 'Atualização da publicação'
    });

    return updated;
  }

  static async createEdition(
    actorUserId: string,
    publicationId: string,
    data: {
      title: string;
      editionDate: string; // YYYY-MM-DD
      contentAssetId: string;
      coverAssetId?: string;
    }
  ): Promise<EditionDTO> {
    const publication = await prisma.publication.findUnique({ where: { id: publicationId } });
    if (!publication) throw new AppError('Publicação não encontrada.', 404, 'NOT_FOUND');

    const edition = await prisma.edition.create({
      data: {
        publicationId,
        title: data.title.trim(),
        editionDate: new Date(data.editionDate),
        contentAssetId: data.contentAssetId,
        coverAssetId: data.coverAssetId || null,
        status: EditionStatus.DRAFT
      },
      include: {
        publication: { include: { publisher: true } }
      }
    });

    await AuditService.record({
      actorUserId,
      publisherId: publication.publisherId,
      action: 'CREATE',
      entityType: 'EDITION',
      entityId: edition.id,
      reason: `Criação da edição ${edition.title} em rascunho`
    });

    return {
      id: edition.id,
      publicationId: edition.publicationId,
      publicationTitle: edition.publication.title,
      publisherName: edition.publication.publisher.name,
      title: edition.title,
      editionDate: edition.editionDate.toISOString().split('T')[0],
      contentAssetId: edition.contentAssetId,
      coverAssetId: edition.coverAssetId,
      coverUrl: edition.coverAssetId ? `/api/v1/assets/${edition.coverAssetId}` : null,
      status: edition.status as EditionStatus,
      publishedAt: null,
      createdAt: edition.createdAt.toISOString()
    };
  }

  static async publishEdition(actorUserId: string, editionId: string) {
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: { publication: true }
    });

    if (!edition) throw new AppError('Edição não encontrada.', 404, 'NOT_FOUND');

    const updated = await prisma.edition.update({
      where: { id: editionId },
      data: {
        status: EditionStatus.PUBLISHED,
        publishedAt: new Date()
      }
    });

    await AuditService.record({
      actorUserId,
      publisherId: edition.publication.publisherId,
      action: 'PUBLISH',
      entityType: 'EDITION',
      entityId: editionId,
      reason: `Publicação da edição ${edition.title}`
    });

    return updated;
  }

  static async withdrawEdition(actorUserId: string, editionId: string, reason: string) {
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: { publication: true }
    });

    if (!edition) throw new AppError('Edição não encontrada.', 404, 'NOT_FOUND');

    const updated = await prisma.edition.update({
      where: { id: editionId },
      data: {
        status: EditionStatus.WITHDRAWN
      }
    });

    await AuditService.record({
      actorUserId,
      publisherId: edition.publication.publisherId,
      action: 'WITHDRAW',
      entityType: 'EDITION',
      entityId: editionId,
      reason: reason || 'Retirada da edição do catálogo público'
    });

    return updated;
  }

  static async registerAsset(
    originalName: string,
    mimeType: string,
    sizeBytes: number,
    storageKey: string,
    visibility: AssetVisibility = AssetVisibility.PRIVATE
  ) {
    return await prisma.asset.create({
      data: {
        originalName,
        mimeType,
        sizeBytes,
        storageKey,
        visibility
      }
    });
  }
}
