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
 * Detailzeilen eines Zeitraums, deren Summen exakt den Firmen-Summen entsprechen:
 * Stunden zählen im Zeitraum des Zeiteintrags, Festpreis/Kundenpreis beim Abschluss.
 */
export async function buildPeriodReport(ctx: Ctx, period: Period) {
  const fin = await loadFinance(ctx, period);
  const rows = new Map<string, ReportRow>();
  const row = (id: string): ReportRow => {
    let r = rows.get(id);
    if (!r) {
      r = { taskId: id, title: "", date: null, memberId: null, minutes: 0, hourlyCents: 0, fixedCents: 0, payoutCents: 0, clientPriceCents: 0, profitCents: 0 };
      rows.set(id, r);
    }
    return r;
  };
  for (const t of fin.doneTasks) {
    const r = row(t.id);
    r.fixedCents += t.fixed_pay_cents ?? 0;
    r.clientPriceCents += fin.clientPrice.get(t.id) ?? 0;
    r.date = t.completed_at;
  }
  const doneIds = new Set(fin.doneTasks.map((t) => t.id));
  for (const e of fin.entries) {
    const r = row(e.task_id);
    r.minutes += minutesBetween(e.started_at, e.ended_at);
    r.hourlyCents += entryPayCents(e);
    if (!r.memberId) r.memberId = e.member_id;
    const d = e.ended_at ?? e.started_at;
    if (!doneIds.has(e.task_id) && (!r.date || d > r.date)) r.date = d;
  }
  const ids = [...rows.keys()];
  if (ids.length) {
    const { data: tasks } = await ctx.supabase.from("tasks").select("id, title, assignee_id").in("id", ids);
    for (const t of tasks ?? []) {
      const r = rows.get(t.id)!;
      r.title = t.title;
      r.memberId = t.assignee_id ?? r.memberId;
    }
  }
  for (const r of rows.values()) {
    r.payoutCents = r.hourlyCents + r.fixedCents;
    r.profitCents = r.clientPriceCents - r.payoutCents;
  }
  const { data: members } = await ctx.supabase.from("members").select("*").eq("firm_id", ctx.firm.id);
  const memberById = new Map<string, Member>((members ?? []).map((m) => [m.id, m]));
  const sorted = [...rows.values()].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  return { fin, rows: sorted, memberById };
}
