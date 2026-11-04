import "server-only";
import type { Ctx } from "@/lib/auth";
import { minutesBetween, type Period } from "@/lib/dates";
import { entryPayCents } from "@/lib/earnings";
import { loadFinance } from "@/lib/finance";
import type { Member } from "@/lib/supabase/types";

export interface ReportRow {
  taskId: string;
  title: string;
  date: string | null; // Erledigt am bzw. letzter Zeiteintrag
  memberId: string | null;
  minutes: number;
  hourlyCents: number;
  fixedCents: number;
  payoutCents: number;
  clientPriceCents: number;
  profitCents: number;
}

/**
 * Detailzeilen eines Zeitraums: eine Zeile pro abgenommener Aufgabe (accepted_at im Zeitraum).
 * Summen entsprechen exakt loadFinance.
 */
export async function buildPeriodReport(ctx: Ctx, period: Period) {
  const fin = await loadFinance(ctx, period);
  const byTask = new Map<string, ReportRow>();
  for (const t of fin.doneTasks) {
    byTask.set(t.id, {
      taskId: t.id,
      title: t.title,
      date: t.accepted_at,
      memberId: t.assignee_id,
      minutes: 0,
      hourlyCents: 0,
      fixedCents: t.fixed_pay_cents ?? 0,
      payoutCents: 0,
      clientPriceCents: fin.clientPrice.get(t.id) ?? 0,
      profitCents: 0,
    });
  }
  for (const e of fin.entries) {
    const r = byTask.get(e.task_id);
    if (!r) continue;
    r.minutes += minutesBetween(e.started_at, e.ended_at);
    r.hourlyCents += entryPayCents(e);
  }
  for (const r of byTask.values()) {
    r.payoutCents = r.hourlyCents + r.fixedCents;
    r.profitCents = r.clientPriceCents - r.payoutCents;
  }
  const { data: members } = await ctx.supabase.from("members").select("*").eq("firm_id", ctx.firm.id);
  const memberById = new Map<string, Member>((members ?? []).map((m) => [m.id, m]));
  const sorted = [...byTask.values()].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  return { fin, rows: sorted, memberById };
}
