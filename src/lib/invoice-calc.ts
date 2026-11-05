import type { VatRate } from "./supabase/types";

export type Line = { description: string; qty: number; unit: string; unit_price_cents: number; vat_rate: VatRate };

/** kaufmännisch runden (wie Postgres round(numeric): .5 von 0 weg) */
export const roundHalfAway = (x: number) => Math.sign(x) * Math.round(Math.abs(x) + 1e-9);

/**
 * Summen nach § 14 UStG – identisch zu private.invoice_totals():
 * Zeilennetto = round(Menge × Preis), Steuer je Satz = round(Σ Netto des Satzes × Satz / 100).
 */
export function invoiceTotals(lines: Line[], smallBusiness: boolean) {
  const rows = lines.map((l) => ({ ...l, net: roundHalfAway(l.qty * l.unit_price_cents) }));
  const byRate = new Map<VatRate, number>();
  for (const r of rows) byRate.set(r.vat_rate, (byRate.get(r.vat_rate) ?? 0) + r.net);
  const groups = [...byRate.entries()].sort((a, b) => b[0] - a[0]).map(([rate, net]) => ({ rate, net, vat: smallBusiness ? 0 : roundHalfAway((net * rate) / 100) }));
  const net = rows.reduce((s, r) => s + r.net, 0);
  const vat = groups.reduce((s, g) => s + g.vat, 0);
  return { rows, groups, net, vat, gross: net + vat };
}

/** Rechnungsnummer wie in issue_invoice(): PREFIX-JJJJ-0001 */
export const formatDocNo = (prefix: string, year: number, n: number) => `${prefix}-${year}-${String(n).padStart(4, "0")}`;

export const SMALL_BUSINESS_NOTE = "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.";

/** offen und Fälligkeit überschritten */
export const isInvoiceOverdue = (i: { status: string; due_date: string | null }, today: string) => i.status === "sent" && !!i.due_date && i.due_date < today;
