import "server-only";
import type { Ctx } from "@/lib/auth";
import { addDays, isoWeekNumber, monthPeriod, startOfWeek, todayISO } from "@/lib/dates";
import { loadFinance } from "@/lib/finance";

export type WeekRow = { from: string; kw: number; done: number; revenueCents: number; laborCents: number; materialsCents: number; profitCents: number };

/** Letzte n Wochen (inkl. aktueller) – nur abgenommene Arbeit, wie in "Geld" */
export async function weeklySeries(ctx: Ctx, n = 8): Promise<WeekRow[]> {
  const cur = startOfWeek(todayISO());
  const weeks = Array.from({ length: n }, (_, i) => addDays(cur, -7 * (n - 1 - i)));
  const fins = await Promise.all(weeks.map((from) => loadFinance(ctx, { from, to: addDays(from, 7) })));
  return weeks.map((from, i) => {
    const f = fins[i]!;
    return { from, kw: isoWeekNumber(from), done: f.doneTasks.length, revenueCents: f.revenueCents, laborCents: f.payoutCents, materialsCents: f.materialsCents, profitCents: f.profitCents };
  });
}

export type TopRow = { memberId: string; tasksDone: number; earningsCents: number; avgRating: number | null; reworks: number };

/** Mitarbeiter des Monats nach abgenommenen Aufgaben */
export async function topMembers(ctx: Ctx, month = todayISO().slice(0, 7), limit = 5): Promise<TopRow[]> {
  const f = await loadFinance(ctx, monthPeriod(`${month}-01`));
  return [...f.perMember.values()]
    .filter((m) => m.tasksDone > 0)
    .sort((a, b) => b.tasksDone - a.tasksDone || b.totalCents - a.totalCents)
    .slice(0, limit)
    .map((m) => ({ memberId: m.memberId, tasksDone: m.tasksDone, earningsCents: m.totalCents, avgRating: m.ratingCount ? m.ratingSum / m.ratingCount : null, reworks: m.reworks }));
}
