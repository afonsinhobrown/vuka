import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import {
  PlanCode,
  SubscriptionPlan,
  getPlan,
  isPlanCode,
  listPlans
} from '../../lib/plans';
import { ArticleStatus, OrderStatus } from '@vuka/shared';

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';

export interface PlanUsage {
  publications: number;
  articlesThisMonth: number;
  salesThisMonth: number;
}

export interface SubscriptionOverview {
  publisherId: string;
  publisherName: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startedAt: string | null;
  renewsAt: string | null;
  /** true quando `renewsAt` já passou (subscrição por renovar). */
  overdue: boolean;
  /** Dias de carência depois da renovação antes de bloquear. */
  graceDays: number;
  /** true quando está em atraso mas ainda dentro da carência. */
  inGrace: boolean;
  /** true quando já passou a carência: publicação e vendas bloqueadas. */
  blocked: boolean;
  usage: PlanUsage;
  remaining: {
    publications: number | null;
    articlesThisMonth: number | null;
    salesThisMonth: number | null;
  };
}

/** Carência configurável: SUBSCRIPTION_GRACE_DAYS (por omissão 5). */
export function subscriptionGraceDays(): number {
  const configured = Number(process.env.SUBSCRIPTION_GRACE_DAYS);
  return Number.isFinite(configured) && configured >= 0 ? configured : 5;
}

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function remainingOf(limit: number | null, used: number): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - used);
}

/** Limite formatado para mensagens de erro. */
function limitLabel(value: number | null): string {
  return value === null ? 'ilimitado' : String(value);
}

export class SubscriptionService {
  static listPlans(): SubscriptionPlan[] {
    return listPlans();
  }

  static async getUsage(publisherId: string): Promise<PlanUsage> {
    const since = monthStart();

    const [publications, articlesThisMonth, salesThisMonth] = await Promise.all([
      prisma.publication.count({ where: { publisherId } }),
      prisma.article.count({
        where: {
          publisherId,
          status: ArticleStatus.PUBLISHED,
          publishedAt: { gte: since }
        }
      }),
      prisma.order.count({
        where: {
          offer: { publisherId },
          status: OrderStatus.PAID,
          createdAt: { gte: since }
        }
      })
    ]);

    return { publications, articlesThisMonth, salesThisMonth };
  }

  static async getOverview(publisherId: string): Promise<SubscriptionOverview> {
    const publisher = await prisma.publisher.findUnique({ where: { id: publisherId } });
    if (!publisher) {
      throw new AppError('Editora não encontrada.', 404, 'PUBLISHER_NOT_FOUND');
    }

    const plan = getPlan(publisher.planCode);
    const usage = await this.getUsage(publisherId);
    const renewsAt = publisher.subscriptionRenewsAt;
    const graceDays = subscriptionGraceDays();
    const overdue = Boolean(renewsAt && renewsAt.getTime() < Date.now());
    const graceDeadline = renewsAt
      ? new Date(renewsAt.getTime() + graceDays * 24 * 60 * 60 * 1000)
      : null;
    const inGrace = Boolean(overdue && graceDeadline && Date.now() <= graceDeadline.getTime());
    const blocked =
      publisher.subscriptionStatus !== 'ACTIVE' ||
      Boolean(overdue && graceDeadline && Date.now() > graceDeadline.getTime());

    return {
      publisherId: publisher.id,
      publisherName: publisher.name,
      plan,
      status: publisher.subscriptionStatus as SubscriptionStatus,
      startedAt: publisher.subscriptionStartedAt?.toISOString() || null,
      renewsAt: renewsAt?.toISOString() || null,
      overdue,
      graceDays,
      inGrace,
      blocked,
      usage,
      remaining: {
        publications: remainingOf(plan.maxPublications, usage.publications),
        articlesThisMonth: remainingOf(plan.maxArticlesPerMonth, usage.articlesThisMonth),
        salesThisMonth: remainingOf(plan.maxSalesPerMonth, usage.salesThisMonth)
      }
    };
  }

  /* ---------------- Guardas de limites ---------------- */

  /**
   * Valida o estado da subscrição antes de publicar. Lança AppError quando:
   *  - a conta está suspensa/cancelada
   *  - a renovação está em atraso
   */
  private static async assertSubscriptionActive(publisherId: string) {
    const publisher = await prisma.publisher.findUnique({ where: { id: publisherId } });
    if (!publisher) {
      throw new AppError('Editora não encontrada.', 404, 'PUBLISHER_NOT_FOUND');
    }

    if (publisher.subscriptionStatus !== 'ACTIVE') {
      throw new AppError(
        'A subscrição do jornal não está ativa. Regularize o plano para voltar a publicar.',
        403,
        'SUBSCRIPTION_INACTIVE'
      );
    }

    if (publisher.subscriptionRenewsAt) {
      const graceMs = subscriptionGraceDays() * 24 * 60 * 60 * 1000;
      const deadline = publisher.subscriptionRenewsAt.getTime() + graceMs;

      if (Date.now() > deadline) {
        throw new AppError(
          `A subscrição do jornal expirou há mais de ${subscriptionGraceDays()} dias de carência. ` +
            'Regularize a mensalidade para voltar a publicar e vender.',
          403,
          'SUBSCRIPTION_OVERDUE'
        );
      }
    }

    return publisher;
  }

  static async assertCanCreatePublication(publisherId: string): Promise<void> {
    const publisher = await this.assertSubscriptionActive(publisherId);
    const plan = getPlan(publisher.planCode);
    const usage = await this.getUsage(publisherId);

    if (usage.publications >= plan.maxPublications) {
      throw new AppError(
        `O plano ${plan.name} permite ${limitLabel(plan.maxPublications)} título(s) e já tem ${usage.publications}. ` +
          'Faça upgrade para publicar mais jornais.',
        403,
        'PLAN_LIMIT_PUBLICATIONS'
      );
    }
  }

  static async assertCanPublishArticle(publisherId: string): Promise<void> {
    const publisher = await this.assertSubscriptionActive(publisherId);
    const plan = getPlan(publisher.planCode);
    if (plan.maxArticlesPerMonth === null) return;

    const usage = await this.getUsage(publisherId);
    if (usage.articlesThisMonth >= plan.maxArticlesPerMonth) {
      throw new AppError(
        `O plano ${plan.name} permite ${plan.maxArticlesPerMonth} artigos por mês e o limite já foi atingido. ` +
          'Faça upgrade para publicar mais.',
        403,
        'PLAN_LIMIT_ARTICLES'
      );
    }
  }

  static async assertCanSell(publisherId: string): Promise<void> {
    const publisher = await this.assertSubscriptionActive(publisherId);
    const plan = getPlan(publisher.planCode);
    if (plan.maxSalesPerMonth === null) return;

    const usage = await this.getUsage(publisherId);
    if (usage.salesThisMonth >= plan.maxSalesPerMonth) {
      throw new AppError(
        `O plano ${plan.name} permite ${plan.maxSalesPerMonth} vendas por mês e o limite já foi atingido. ` +
          'Faça upgrade para continuar a vender.',
        403,
        'PLAN_LIMIT_SALES'
      );
    }
  }

  /* ---------------- Administração ---------------- */

  static async changePlan(
    actorUserId: string,
    publisherId: string,
    data: { planCode?: string; status?: SubscriptionStatus; renewsAt?: string | null }
  ): Promise<SubscriptionOverview> {
    const publisher = await prisma.publisher.findUnique({ where: { id: publisherId } });
    if (!publisher) {
      throw new AppError('Editora não encontrada.', 404, 'PUBLISHER_NOT_FOUND');
    }

    if (data.planCode !== undefined && !isPlanCode(data.planCode)) {
      throw new AppError('Plano inválido. Use BASIC, STANDARD ou PREMIUM.', 400, 'INVALID_PLAN');
    }

    let renewsAt: Date | null | undefined;
    if (data.renewsAt === null) renewsAt = null;
    else if (typeof data.renewsAt === 'string' && data.renewsAt.trim()) {
      const parsed = new Date(data.renewsAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new AppError('Data de renovação inválida.', 400, 'INVALID_RENEWS_AT');
      }
      renewsAt = parsed;
    }

    const planChanged = data.planCode !== undefined && data.planCode !== publisher.planCode;

    await prisma.publisher.update({
      where: { id: publisherId },
      data: {
        planCode: data.planCode !== undefined ? (data.planCode as PlanCode) : undefined,
        subscriptionStatus: data.status !== undefined ? data.status : undefined,
        subscriptionRenewsAt: renewsAt !== undefined ? renewsAt : undefined
      }
    });

    await AuditService.record({
      actorUserId,
      publisherId,
      action: 'UPDATE',
      entityType: 'PUBLISHER_SUBSCRIPTION',
      entityId: publisherId,
      reason: planChanged
        ? `Plano alterado de ${publisher.planCode} para ${data.planCode}`
        : 'Atualização da subscrição do jornal',
      metadata: {
        from: publisher.planCode,
        to: data.planCode ?? publisher.planCode,
        status: data.status ?? publisher.subscriptionStatus,
        renewsAt:
          renewsAt !== undefined
            ? renewsAt?.toISOString() || null
            : publisher.subscriptionRenewsAt?.toISOString() || null
      }
    });

    return this.getOverview(publisherId);
  }
}
