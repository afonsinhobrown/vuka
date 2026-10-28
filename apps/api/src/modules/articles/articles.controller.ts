import { Request, Response, NextFunction } from 'express';
import { ArticlesService } from './articles.service';
import { PaywallService } from '../paywall/paywall.service';

export class ArticlesController {
  static async listPublic(req: Request, res: Response, next: NextFunction) {
    try {
      const { sectionId, publicationId, publisherId, q, limit, offset } = req.query;
      const result = await ArticlesService.listPublic({
        sectionId: sectionId as string,
        publicationId: publicationId as string,
        publisherId: publisherId as string,
        q: q as string,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined
      });
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const article = await ArticlesService.getBySlug(req.params.slug);
      const { contentHtml, bodyJson, pdfAssetId, ...publicMeta } = article as any;
      return res.status(200).json({ article: publicMeta });
    } catch (error) {
      next(error);
    }
  }

  static async readArticle(req: Request, res: Response, next: NextFunction) {
    try {
      const article = await ArticlesService.getById(req.params.id);
      if (!article) {
        return res.status(404).json({ error: { code: 'ARTICLE_NOT_FOUND', message: 'Matéria não encontrada.' } });
      }
      const userId = (req as any).user?.userId;
      const access = await PaywallService.checkArticleAccess({
        userId,
        articleId: article.id,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      if (!access.allowed) {
        return res.status(402).json({
          error: {
            code: access.reason,
            message: access.reason === 'METERED_EXHAUSTED' ? 'Limite de leituras gratuitas atingido.' : 'É necessário adquirir esta matéria ou ter assinatura válida.'
          },
          paywall: access
        });
      }
      return res.status(200).json({
        article: {
          id: article.id,
          title: article.title,
          slug: article.slug,
          subtitle: article.subtitle,
          excerpt: article.excerpt,
          contentHtml: article.contentHtml,
          bodyJson: article.bodyJson,
          authorName: article.authorName,
          publishedAt: article.publishedAt,
          tags: article.tags,
          sectionId: article.sectionId,
          publicationId: article.publicationId,
          publisherId: article.publisherId
        },
        access
      });
    } catch (error) {
      next(error);
    }
  }

  static async adminList(req: Request, res: Response, next: NextFunction) {
    try {
      const articles = await (await import('../../lib/prisma')).prisma.article.findMany({
        orderBy: { updatedAt: 'desc' },
        include: { publisher: true, publication: true, section: true }
      });
      return res.status(200).json({ articles });
    } catch (error) {
      next(error);
    }
  }

  static async adminCreate(req: Request, res: Response, next: NextFunction) {
    try {
      const article = await ArticlesService.create(req.body, (req as any).user?.userId);
      return res.status(201).json({ article });
    } catch (error) {
      next(error);
    }
  }

  static async adminUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const article = await ArticlesService.update(req.params.id, req.body, (req as any).user?.userId);
      return res.status(200).json({ article });
    } catch (error) {
      next(error);
    }
  }

  static async adminPublish(req: Request, res: Response, next: NextFunction) {
    try {
      const article = await ArticlesService.publish(req.params.id, (req as any).user?.userId);
      return res.status(200).json({ article });
    } catch (error) {
      next(error);
    }
  }

  static async adminRemove(req: Request, res: Response, next: NextFunction) {
    try {
      const article = await ArticlesService.remove(req.params.id, (req as any).user?.userId);
      return res.status(200).json({ article });
    } catch (error) {
      next(error);
    }
  }
}
