/**
 * VUKA Currency Utilities
 * Conforme RNF-08 e RB-09: Valores financeiros são SEMPRE armazenados como inteiros em unidades menores
 * (ex: Meticais MZN em centavos, onde 100.00 MZN = 10000 minor units).
 */

export const DEFAULT_CURRENCY = 'MZN';

export function formatMoney(minorUnits: number, currency = DEFAULT_CURRENCY): string {
  const major = (minorUnits / 100).toFixed(2);
  // Formato: "100.00 MZN" ou "1.250,00 MT"
  return `${Number(major).toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function toMinorUnits(majorUnits: number): number {
  return Math.round(majorUnits * 100);
}

export function toMajorUnits(minorUnits: number): number {
  return minorUnits / 100;
}
