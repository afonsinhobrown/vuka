import { prisma } from '../../lib/prisma';
import { EntitlementStatus, LibraryItemDTO } from '@vuka/shared';

export class EntitlementService {
  /**
   * Verifica se o utilizador possui direito ativo para ler uma edição específica
   * Fonte Única de Verdade (RB-03, RNF-01)
   */
  static async hasActiveAccessToEdition(userId: string, editionId: string): Promise<boolean> {
    const now = new Date();

    const global = await prisma.entitlement.findFirst({
      where: {
        userId,
        scope: 'ALL_ACCESS' as any,
        status: EntitlementStatus.ACTIVE,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }]
      }
    });
    if (global) return true;

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, publicationId: true }
    });

    if (!edition) return false;

    // 1. Verifica entitlement direto da edição
    const directEntitlement = await prisma.entitlement.findFirst({
      where: {
        userId,
        editionId,
        status: EntitlementStatus.ACTIVE,
        startsAt: { lte: now },
        OR: [
          { endsAt: null }, // Acesso permanente
          { endsAt: { gte: now } } // Vigente
        ]
      }
    });

    if (directEntitlement) return true;

    // 2. Verifica assinatura ativa da publicação
    const publicationEntitlement = await prisma.entitlement.findFirst({
      where: {
        userId,
        publicationId: edition.publicationId,
        status: EntitlementStatus.ACTIVE,
        startsAt: { lte: now },
        endsAt: { gte: now }
      }
    });

    return !!publicationEntitlement;
  }

  static async hasActiveAccessToArticle(userId: string, articleId: string): Promise<boolean> {
    const now = new Date();

    const global = await prisma.entitlement.findFirst({
      where: {
        userId,
        scope: 'ALL_ACCESS' as any,
        status: EntitlementStatus.ACTIVE,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }]
      }
    });
    if (global) return true;

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, publicationId: true }
    });
    if (!article) return false;

    const articleEnt = await prisma.entitlement.findFirst({
      where: {
        userId,
        articleId,
        status: EntitlementStatus.ACTIVE,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }]
      }
    });
    if (articleEnt) return true;

    if (article.publicationId) {
      const pubEnt = await prisma.entitlement.findFirst({
        where: {
          userId,
          publicationId: article.publicationId,
          status: EntitlementStatus.ACTIVE,
          startsAt: { lte: now },
          endsAt: { gte: now }
        }
      });
      if (pubEnt) return true;
    }

    return false;
  }

  /**
   * Retorna a biblioteca pessoal do leitor (RF-08)
   */
  static async getUserLibrary(userId: string): Promise<LibraryItemDTO[]> {
    const now = new Date();

    // Entitlements do utilizador
    const entitlements = await prisma.entitlement.findMany({
      where: {
        userId,
        status: { in: [EntitlementStatus.ACTIVE, EntitlementStatus.EXPIRED] }
      },
      include: {
        edition: {
          include: {
            publication: {
              include: { publisher: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const libraryItems: LibraryItemDTO[] = [];

    for (const ent of entitlements) {
      if (ent.edition) {
        const isExpired = ent.endsAt !== null && new Date(ent.endsAt) < now;
        libraryItems.push({
          entitlementId: ent.id,
          editionId: ent.edition.id,
          title: ent.edition.title,
          editionDate: ent.edition.editionDate.toISOString().split('T')[0],
          publicationTitle: ent.edition.publication.title,
          publisherName: ent.edition.publication.publisher.name,
          coverUrl: ent.edition.coverAssetId ? `/api/v1/assets/${ent.edition.coverAssetId}` : null,
          accessStatus: isExpired ? EntitlementStatus.EXPIRED : (ent.status as EntitlementStatus),
          endsAt: ent.endsAt ? ent.endsAt.toISOString() : null,
          isExpired
        });
      }
    }

    return libraryItems;
  }
}
