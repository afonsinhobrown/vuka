import { prisma } from '../lib/prisma';
import { EntitlementStatus, ArticleStatus, PaywallType } from '@vuka/shared';

export type PaywallResult =
  | { allowed: true; reason: 'GLOBAL_ACCESS' | 'PUBLICATION_SUBSCRIPTION' | 'ARTICLE_PURCHASE' | 'METERED_FREE' }
  | { allowed: false; reason: 'PAYWALL_HARD' | 'METERED_EXHAUSTED'; remainingFree?: number };

const METERED_FREE_LIMIT = 3;
const METERED_WINDOW_DAYS = 30;

export class PaywallService {
  static async checkArticleAccess(params: {
    userId?: string | null;
    articleId: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<PaywallResult> {
    const { userId, articleId } = params;
    const now = new Date();

    if (!userId) {
      const article = await prisma.article.findUnique({
        where: { id: articleId },
        select: { isPremium: true, paywallType: true }
      });
      if (!article) return { allowed: false, reason: 'PAYWALL_HARD' };
      if (!article.isPremium) return { allowed: true, reason: 'METERED_FREE' };
      if (article.paywallType === PaywallType.HARD) return { allowed: false, reason: 'PAYWALL_HARD' };
      return { allowed: false, reason: 'PAYWALL_HARD' };
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    if (!user || user.status !== 'ACTIVE') return { allowed: false, reason: 'PAYWALL_HARD' };

    const global = await prisma.entitlement.findFirst({
      where: {
        userId,
        scope: 'ALL_ACCESS' as any,
        status: EntitlementStatus.ACTIVE,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }]
      }
    });
    if (global) return { allowed: true, reason: 'GLOBAL_ACCESS' };

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        publicationId: true,
        isPremium: true,
        paywallType: true,
        status: true
      }
    });
    if (!article || article.status !== ArticleStatus.PUBLISHED) return { allowed: false, reason: 'PAYWALL_HARD' };

    const articleEnt = await prisma.entitlement.findFirst({
      where: {
        userId,
        articleId,
        status: EntitlementStatus.ACTIVE,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }]
      }
    });
    if (articleEnt) return { allowed: true, reason: 'ARTICLE_PURCHASE' };

    if (article.publicationId) {
      const pubEnt = await prisma.entitlement.findFirst({
        where: {
          userId,
          publicationId: article.publicationId,
          status: EntitlementStatus.ACTIVE,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }]
        }
      });
      if (pubEnt) return { allowed: true, reason: 'PUBLICATION_SUBSCRIPTION' };
    }

    if (!article.isPremium) return { allowed: true, reason: 'METERED_FREE' };

    if (article.paywallType === PaywallType.METERED) {
      const since = new Date(Date.now() - METERED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const count = await prisma.articleRead.count({
        where: {
          userId,
          readAt: { gte: since }
        }
      });
      if (count < METERED_FREE_LIMIT) {
        await prisma.articleRead.create({
          data: {
            userId,
            articleId,
            ip: params.ip || null,
            userAgent: params.userAgent || null
          }
        });
        return { allowed: true, reason: 'METERED_FREE' };
      }
      return { allowed: false, reason: 'METERED_EXHAUSTED', remainingFree: 0 };
    }

    return { allowed: false, reason: 'PAYWALL_HARD' };
  }

  static async getMeteredUsage(userId: string) {
    const since = new Date(Date.now() - METERED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const count = await prisma.articleRead.count({
      where: {
        userId,
        readAt: { gte: since }
      }
    });
    return {
      used: count,
      limit: METERED_FREE_LIMIT,
      remaining: Math.max(0, METERED_FREE_LIMIT - count),
      windowDays: METERED_WINDOW_DAYS
    };
  }
}
