import { intlLocale } from "./dates";

export function formatMoney(cents: number, locale = "de"): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** "12,50" oder "12.50" → 1250 Cent. Leer → null. */
export function parseMoneyToCents(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).trim().replace(/\s|€/g, "");
  if (s === "") return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}
