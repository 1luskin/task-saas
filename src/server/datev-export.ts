import "server-only";
import type { Ctx } from "@/lib/auth";
import { addDays, monthPeriod, periodToRange, toISODate } from "@/lib/dates";
import { loadFinance } from "@/lib/finance";
import { BU_VST, DEFAULT_ACCOUNTS, type Booking } from "@/lib/datev";

/**
 * Buchungen eines Monats:
 *  - Erlöse: abgenommene Aufgaben mit Kundenpreis (netto) → Debitor an Erlöskonto (brutto, Automatikkonto)
 *  - Ausgaben: genehmigte, manuell erfasste Ausgaben → Aufwand an Kasse (BU Vorsteuer 19 %)
 *  - Material-Zugänge mit Preis → Wareneingang an Kasse
 * Materialentnahmen sind interne Kostenzuordnung (keine Zahlung) und werden nicht gebucht.
 * Löhne gehören in die Lohnbuchhaltung (DATEV Lohn) – nicht im Buchungsstapel.
 */
export async function datevBookings(ctx: Ctx, month: string): Promise<{ bookings: Booking[]; from: string; to: string }> {
  const period = monthPeriod(`${month}-01`);
  const { fromTs, toTs } = periodToRange(period);
  const f = ctx.firm;
  const acc = { ...DEFAULT_ACCOUNTS[f.datev_skr], ...f.datev_accounts };
  const berlinDate = (ts: string) => toISODate(new Date(ts));

  const [fin, { data: expenses }, { data: moves }, { data: materials }] = await Promise.all([
    loadFinance(ctx, period),
    ctx.supabase.from("expenses").select("*").eq("firm_id", f.id).eq("status", "approved").eq("source", "manual").gte("decided_at", fromTs).lt("decided_at", toTs),
    ctx.supabase.from("material_moves").select("*").eq("firm_id", f.id).eq("kind", "in").gte("created_at", fromTs).lt("created_at", toTs),
    ctx.supabase.from("materials").select("id,name").eq("firm_id", f.id),
  ]);

  const bookings: Booking[] = [];
  const vat = f.small_business ? 0 : f.vat_rate;
  const revenueAccount = f.small_business ? acc.revenueSmall : vat === 19 ? acc.revenue19 : vat === 7 ? acc.revenue7 : acc.revenue0;
  for (const t of fin.doneTasks) {
    const net = fin.clientPrice.get(t.id) ?? 0;
    if (net <= 0 || !t.accepted_at) continue;
    bookings.push({
      amountCents: Math.round(net * (100 + vat) / 100), side: "S", account: acc.debitor, contraAccount: revenueAccount,
      date: berlinDate(t.accepted_at), docNo: `A${t.id.slice(0, 8)}`, text: t.title,
    });
  }
  for (const e of expenses ?? []) {
    bookings.push({
      amountCents: e.amount_cents, side: "S", account: acc.expense, contraAccount: acc.cash, buKey: BU_VST[19],
      date: berlinDate(e.decided_at ?? e.created_at), docNo: `E${e.id.slice(0, 8)}`, text: e.description,
    });
  }
  for (const m of moves ?? []) {
    const cents = Math.round(Number(m.qty) * m.unit_cost_cents);
    if (cents <= 0) continue;
    bookings.push({
      amountCents: cents, side: "S", account: acc.material, contraAccount: acc.cash, buKey: BU_VST[19],
      date: berlinDate(m.created_at), docNo: `M${m.id.slice(0, 8)}`, text: `Material: ${materials?.find((x) => x.id === m.material_id)?.name ?? ""}`,
    });
  }
  bookings.sort((a, b) => a.date.localeCompare(b.date));
  return { bookings, from: period.from, to: addDays(period.to, -1) };
}
