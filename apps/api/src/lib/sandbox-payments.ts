import { SettingsService } from '../modules/settings/settings.service';

/**
 * Modo sandbox do gateway de pagamentos.
 *
 * Em modo de testes a PaySuite cobra um valor **fixo** (10,00 MT por omissão),
 * independentemente do preço do jornal. O webhook chega com esse valor enquanto
 * o pedido na VUKA tem o preço do catálogo, e a validação de valor (RB-02)
 * rejeitava a notificação com AMOUNT_MISMATCH — o pedido ficava PENDING.
 *
 * O modo é controlado pelo **botão no painel admin** (guardado em
 * `system_settings`). A variável de ambiente `PAYSUITE_SANDBOX` serve apenas de
 * valor inicial, quando ainda não há definição gravada.
 *
 * Regras de segurança:
 *  - Só aceita a diferença com o sandbox ligado.
 *  - Só aceita se o valor recebido for EXACTAMENTE o valor fixo do sandbox.
 *  - Cada aceitação fica registada na trilha de auditoria.
 */

export const SANDBOX_SETTING_KEY = 'payments.sandbox';
export const SANDBOX_AMOUNT_SETTING_KEY = 'payments.sandboxAmountMinorUnits';

/** Valor fixo cobrado pela PaySuite em modo sandbox: 10,00 MZN em minor units. */
export const DEFAULT_SANDBOX_AMOUNT_MINOR_UNITS = 1000;

export interface SandboxState {
  enabled: boolean;
  /** Onde veio a decisão: definição do painel ou variável de ambiente. */
  source: 'settings' | 'env';
  amountMinorUnits: number;
}

function envSandboxEnabled(): boolean {
  const raw = (process.env.PAYSUITE_SANDBOX || process.env.PAYMENT_SANDBOX_MODE || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'sandbox';
}

function envSandboxAmount(): number | null {
  const configured = Number(process.env.PAYSUITE_SANDBOX_AMOUNT_MINOR_UNITS);
  return Number.isFinite(configured) && configured > 0 ? configured : null;
}

export async function resolveSandboxState(): Promise<SandboxState> {
  const storedEnabled = await SettingsService.get(SANDBOX_SETTING_KEY);
  const storedAmount = await SettingsService.get(SANDBOX_AMOUNT_SETTING_KEY);

  const enabled = storedEnabled === null ? envSandboxEnabled() : storedEnabled === 'true';

  const parsedAmount = Number(storedAmount);
  const amountMinorUnits =
    storedAmount !== null && Number.isFinite(parsedAmount) && parsedAmount > 0
      ? parsedAmount
      : envSandboxAmount() ?? DEFAULT_SANDBOX_AMOUNT_MINOR_UNITS;

  return {
    enabled,
    source: storedEnabled === null ? 'env' : 'settings',
    amountMinorUnits
  };
}

/** Valor fixo aceite em sandbox (minor units), ou `null` se o sandbox está desligado. */
export async function resolveSandboxFixedAmount(): Promise<number | null> {
  const state = await resolveSandboxState();
  return state.enabled ? state.amountMinorUnits : null;
}

export async function setSandboxEnabled(
  enabled: boolean,
  updatedBy?: string | null
): Promise<SandboxState> {
  await SettingsService.set(SANDBOX_SETTING_KEY, enabled ? 'true' : 'false', updatedBy);
  return resolveSandboxState();
}
