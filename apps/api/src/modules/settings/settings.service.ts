import { prisma } from '../../lib/prisma';

/**
 * Configurações da plataforma guardadas na tabela `system_settings`.
 * Permitem alterar comportamentos em runtime (sem redeploy) — ex.: o modo
 * sandbox dos pagamentos, que o administrador liga/desliga no painel.
 */
export class SettingsService {
  static async get(key: string): Promise<string | null> {
    try {
      const row = await prisma.systemSetting.findUnique({ where: { key } });
      return row?.value ?? null;
    } catch (error) {
      // Tabela ainda não criada (antes de `db push`) → usa-se o fallback do env.
      console.warn(`[SettingsService] Não foi possível ler a definição "${key}":`, error);
      return null;
    }
  }

  static async set(key: string, value: string, updatedBy?: string | null) {
    return prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, updatedBy: updatedBy || null },
      update: { value, updatedBy: updatedBy || null }
    });
  }

  static async remove(key: string): Promise<void> {
    try {
      await prisma.systemSetting.delete({ where: { key } });
    } catch {
      // inexistente → nada a fazer
    }
  }
}
