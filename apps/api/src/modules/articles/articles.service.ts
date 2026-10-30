import { prisma } from '../../lib/prisma';
import { ArticleStatus, PaywallType } from '@vuka/shared';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { v4 as uuidv4 } from 'uuid';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export class ArticlesService {
  static async listPublic(filters: {
    sectionId?: string;
    publicationId?: string;
    publisherId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const { sectionId, publicationId, publisherId, q, limit = 20, offset = 0 } = filters;
    const where: any = {
      status: ArticleStatus.PUBLISHED,
      OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }]
    };
    if (sectionId) where.sectionId = sectionId;
    if (publicationId) where.publicationId = publicationId;
    if (publisherId) where.publisherId = publisherId;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { excerpt: { contains: q, mode: 'insensitive' } },
        { tags: { hasSome: [q] } }
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          publisher: true,
          publication: true,
          section: true
        }
      }),
      prisma.article.count({ where })
    ]);

    return {
      articles: articles.map((a: any) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        subtitle: a.subtitle,
        excerpt: a.excerpt,
        coverAssetId: a.coverAssetId,
        tags: a.tags,
        isPremium: a.isPremium,
        paywallType: a.paywallType,
        publishedAt: a.publishedAt,
        section: a.section ? { id: a.section.id, name: a.section.name, slug: a.section.slug } : null,
        publication: a.publication ? { id: a.publication.id, title: a.publication.title } : null,
        publisher: { id: a.publisher.id, name: a.publisher.name },
        authorName: a.authorName
      })),
      total
    };
  }

  static async getBySlug(slug: string) {
    const article = await prisma.article.findFirst({
      where: { slug },
      include: {
        publisher: true,
        publication: true,
        section: true,
        author: true
      }
    });
    if (!article || article.status !== ArticleStatus.PUBLISHED) {
      throw new AppError('Matéria não encontrada ou não publicada.', 404, 'ARTICLE_NOT_FOUND');
    }
    return article;
  }

  static async getById(id: string) {
    return prisma.article.findUnique({
      where: { id },
      include: {
        publisher: true,
        publication: true,
        section: true
      }
    });
  }

  static async create(data: any, actorUserId?: string) {
    const slug = data.slug ? slugify(data.slug) : slugify(data.title);
    const article = await prisma.article.create({
      data: {
        publisherId: data.publisherId,
        publicationId: data.publicationId || null,
        sectionId: data.sectionId || null,
        authorId: data.authorId || actorUserId || null,
        authorName: data.authorName || null,
        title: data.title,
        slug,
        subtitle: data.subtitle || null,
        excerpt: data.excerpt || null,
        contentHtml: data.contentHtml || null,
        bodyJson: data.bodyJson || null,
        coverAssetId: data.coverAssetId || null,
        pdfAssetId: data.pdfAssetId || null,
        tags: Array.isArray(data.tags) ? data.tags : [],
        isPremium: data.isPremium !== undefined ? data.isPremium : true,
        paywallType: data.paywallType || PaywallType.HARD,
        status: data.status || ArticleStatus.DRAFT,
        publishedAt: data.status === ArticleStatus.PUBLISHED ? new Date() : null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null
      }
    });

    await AuditService.record({
      actorUserId: actorUserId || null,
      publisherId: article.publisherId,
      action: 'CREATE',
      entityType: 'ARTICLE',
      entityId: article.id,
      reason: `Criação de matéria ${article.title}`
    });

    return article;
  }

  static async update(id: string, data: any, actorUserId?: string) {
    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) throw new AppError('Matéria não encontrada.', 404, 'ARTICLE_NOT_FOUND');

    const slug = data.slug ? slugify(data.slug) : existing.slug;
    const updateData: any = { ...data, slug };
    if (data.status === ArticleStatus.PUBLISHED && !existing.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const article = await prisma.article.update({
      where: { id },
      data: updateData
    });

    await AuditService.record({
      actorUserId: actorUserId || null,
      publisherId: article.publisherId,
      action: 'UPDATE',
      entityType: 'ARTICLE',
      entityId: article.id,
      reason: `Atualização de matéria ${article.title}`
    });

    return article;
  }

  static async publish(id: string, actorUserId?: string) {
    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Artigo não encontrado.', 404, 'ARTICLE_NOT_FOUND');
    }

    // Limite do plano (artigos publicados por mês)
    await SubscriptionService.assertCanPublishArticle(existing.publisherId);

    const article = await prisma.article.update({
      where: { id },
      data: {
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
        scheduledAt: null
      }
    });
    await AuditService.record({
      actorUserId: actorUserId || null,
      publisherId: article.publisherId,
      action: 'PUBLISH',
      entityType: 'ARTICLE',
      entityId: article.id,
      reason: `Publicação de matéria ${article.title}`
    });
    return article;
  }

  static async remove(id: string, actorUserId?: string) {
    const article = await prisma.article.delete({ where: { id } });
    await AuditService.record({
      actorUserId: actorUserId || null,
      publisherId: article.publisherId,
      action: 'DELETE',
      entityType: 'ARTICLE',
      entityId: article.id,
      reason: `Remoção de matéria ${article.title}`
    });
    return article;
  }
}
