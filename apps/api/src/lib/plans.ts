/**
 * Planos de subscrição das editoras/jornais.
 *
 * Preços em minor units (Meticais × 100). `null` = sem limite.
 * Este ficheiro é a fonte única de verdade — se os limites mudarem, muda-se aqui.
 */

export type PlanCode = 'BASIC' | 'STANDARD' | 'PREMIUM';

export interface SubscriptionPlan {
  code: PlanCode;
  name: string;
  tagline: string;
  priceMinorUnits: number;
  /** Títulos (jornais/revistas) que pode ter publicados. */
  maxPublications: number;
  /** Artigos/reportagens publicados por mês. `null` = ilimitado. */
  maxArticlesPerMonth: number | null;
  /** Vendas (edições) concluídas por mês. `null` = ilimitado. */
  maxSalesPerMonth: number | null;
  highlights: string[];
}

export const SUBSCRIPTION_PLANS: Record<PlanCode, SubscriptionPlan> = {
  BASIC: {
    code: 'BASIC',
    name: 'Basic',
    tagline: 'Para começar a publicar',
    priceMinorUnits: 300000, // 3.000,00 MT
    maxPublications: 1,
    maxArticlesPerMonth: 30,
    maxSalesPerMonth: 500,
    highlights: ['1 título', '30 artigos por mês', '500 vendas por mês']
  },
  STANDARD: {
    code: 'STANDARD',
    name: 'Standard',
    tagline: 'Para jornais em crescimento',
    priceMinorUnits: 500000, // 5.000,00 MT
    maxPublications: 3,
    maxArticlesPerMonth: 120,
    maxSalesPerMonth: 2000,
    highlights: ['3 títulos', '120 artigos por mês', '2.000 vendas por mês']
  },
  PREMIUM: {
    code: 'PREMIUM',
    name: 'Premium',
    tagline: 'Para grupos editoriais',
    priceMinorUnits: 700000, // 7.000,00 MT
    maxPublications: 10,
    maxArticlesPerMonth: null,
    maxSalesPerMonth: 10000,
    highlights: ['10 títulos', 'artigos ilimitados', '10.000 vendas por mês']
  }
};

export const DEFAULT_PLAN_CODE: PlanCode = 'BASIC';

export const PLAN_CODES = Object.keys(SUBSCRIPTION_PLANS) as PlanCode[];

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === 'string' && PLAN_CODES.includes(value as PlanCode);
}

export function getPlan(code: string | null | undefined): SubscriptionPlan {
  return isPlanCode(code) ? SUBSCRIPTION_PLANS[code] : SUBSCRIPTION_PLANS[DEFAULT_PLAN_CODE];
}

/** Lista ordenada por preço, para tabelas de preços. */
export function listPlans(): SubscriptionPlan[] {
  return PLAN_CODES.map((code) => SUBSCRIPTION_PLANS[code]);
}
