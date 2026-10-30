import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error.middleware';
import { OfferType, OfferStatus, OfferDTO, AuditEventAction } from '@vuka/shared';
import { AuditService } from '../audit/audit.service';

export class OfferService {
  static async listOffers(options: {
    publisherId?: string;
    publicationId?: string;
    status?: OfferStatus;
  }): Promise<OfferDTO[]> {
    const where: any = {};
    if (options.publisherId) where.publisherId = options.publisherId;
    if (options.publicationId) where.publicationId = options.publicationId;
    if (options.status) where.status = options.status;

    const offers = await prisma.offer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        publisher: { select: { id: true, name: true } },
        publication: { select: { id: true, title: true } }
      }
    });

    return offers.map((o: any) => ({
      id: o.id,
      publisherId: o.publisherId,
      publisherName: o.publisher?.name || null,
      publicationId: o.publicationId,
      editionId: o.editionId,
      type: o.type as OfferType,
      title: o.title,
      description: o.description,
      priceMinorUnits: o.priceMinorUnits,
      currency: o.currency,
      validityDays: o.validityDays,
      status: o.status as OfferStatus,
      createdAt: o.createdAt.toISOString()
    }));
  }

  static async getOfferById(id: string): Promise<OfferDTO> {
    const o = await prisma.offer.findUnique({
      where: { id },
      include: {
        publisher: { select: { id: true, name: true } },
        publication: { select: { id: true, title: true } }
      }
    });

    if (!o) throw new AppError('Oferta não encontrada.', 404, 'OFFER_NOT_FOUND');

    return {
      id: o.id,
      publisherId: o.publisherId,
      publisherName: o.publisher?.name || null,
      publicationId: o.publicationId,
      editionId: o.editionId,
      type: o.type as OfferType,
      title: o.title,
      description: o.description,
      priceMinorUnits: o.priceMinorUnits,
      currency: o.currency,
      validityDays: o.validityDays,
      status: o.status as OfferStatus,
      createdAt: o.createdAt.toISOString()
    };
  }

  static async createOffer(
    actorUserId: string,
    data: {
      publisherId?: string;
      publicationId?: string;
      editionId?: string;
      type: OfferType;
      title: string;
      description?: string;
      priceMinorUnits: number;
      currency?: string;
      validityDays?: number;
    }
  ): Promise<OfferDTO> {
    if (data.priceMinorUnits <= 0) {
      throw new AppError('O preço deve ser superior a zero.', 400, 'INVALID_PRICE');
    }

    let publisherId = data.publisherId || null;

    if (data.publicationId) {
      const publication = await prisma.publication.findUnique({
        where: { id: data.publicationId },
        select: { publisherId: true }
      });
      if (!publication) throw new AppError('Publicação não encontrada.', 404, 'PUBLICATION_NOT_FOUND');
      if (!publisherId) publisherId = publication.publisherId;
      if (publisherId !== publication.publisherId) {
        throw new AppError('A publicação indicada pertence a outra editora.', 403, 'FORBIDDEN');
      }
    }

    if (data.editionId) {
      const edition = await prisma.edition.findUnique({
        where: { id: data.editionId },
        include: { publication: { select: { publisherId: true } } }
      });
      if (!edition) throw new AppError('Edição não encontrada.', 404, 'EDITION_NOT_FOUND');
      if (!publisherId) publisherId = edition.publication.publisherId;
      if (publisherId !== edition.publication.publisherId) {
        throw new AppError('A edição indicada pertence a outra editora.', 403, 'FORBIDDEN');
      }
    }

    const offer = await prisma.offer.create({
      data: {
        publisherId,
        publicationId: data.publicationId || null,
        editionId: data.editionId || null,
        type: data.type,
        title: data.title.trim(),
        description: data.description?.trim(),
        priceMinorUnits: Math.round(data.priceMinorUnits),
        currency: data.currency || 'MZN',
        validityDays: data.validityDays || null,
        status: OfferStatus.ACTIVE
      },
      include: { publisher: true }
    });

    await AuditService.record({
      actorUserId,
      publisherId,
      action: AuditEventAction.CREATE,
      entityType: 'OFFER',
      entityId: offer.id,
      reason: `Criação da oferta ${offer.title} com valor ${offer.priceMinorUnits} ${offer.currency}`
    });

    return {
      id: offer.id,
      publisherId: offer.publisherId,
      publisherName: offer.publisher?.name || null,
      publicationId: offer.publicationId,
      editionId: offer.editionId,
      type: offer.type as OfferType,
      title: offer.title,
      description: offer.description,
      priceMinorUnits: offer.priceMinorUnits,
      currency: offer.currency,
      validityDays: offer.validityDays,
      status: offer.status as OfferStatus,
      createdAt: offer.createdAt.toISOString()
    };
  }

  static async updateOffer(
    actorUserId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      priceMinorUnits?: number;
      validityDays?: number;
      status?: OfferStatus;
      reason?: string;
    },
    userPublisherId?: string | null,
    isAdmin = false
  ) {
    const existing = await prisma.offer.findUnique({ where: { id } });
    if (!existing) throw new AppError('Oferta não encontrada.', 404, 'NOT_FOUND');

    if (!isAdmin && existing.publisherId !== userPublisherId) {
      throw new AppError('Acesso negado: esta oferta pertence a outra editora.', 403, 'FORBIDDEN');
    }

    const isPriceChange =
      data.priceMinorUnits !== undefined && data.priceMinorUnits !== existing.priceMinorUnits;

    const updated = await prisma.offer.update({
      where: { id },
      data: {
        title: data.title !== undefined ? data.title.trim() : undefined,
        description: data.description !== undefined ? data.description.trim() : undefined,
        priceMinorUnits: data.priceMinorUnits !== undefined ? Math.round(data.priceMinorUnits) : undefined,
        validityDays: data.validityDays !== undefined ? data.validityDays : undefined,
        status: data.status !== undefined ? data.status : undefined
      }
    });

    await AuditService.record({
      actorUserId,
      publisherId: existing.publisherId,
      action: isPriceChange ? AuditEventAction.PRICE_CHANGE : AuditEventAction.UPDATE,
      entityType: 'OFFER',
      entityId: id,
      reason: data.reason || (isPriceChange ? 'Alteração de preço da oferta' : 'Atualização de oferta'),
      metadata: {
        oldPrice: existing.priceMinorUnits,
        newPrice: updated.priceMinorUnits
      }
    });

    return updated;
  }
}
