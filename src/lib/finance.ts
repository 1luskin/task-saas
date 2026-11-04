import "server-only";
import type { Ctx } from "./auth";
import { periodToRange, type Period } from "./dates";
import { entryPayCents, groupBy } from "./earnings";
import { minutesBetween } from "./dates";
import type { Expense, Task, TimeEntry } from "./supabase/types";
import { shiftNetMinutes, shiftPayCents } from "./shifts";

export interface MemberEarnings {
  memberId: string;
  minutes: number;
  hourlyCents: number;
  fixedCents: number;
  totalCents: number;
  tasksDone: number;
  /** Schichten (nur Mitarbeiter mit Abrechnung nach Schichten haben rate_cents > 0) */
  shiftMinutes: number;
  shiftCents: number;
  /** Prämien (+) / Abzüge (−) mit Wirkungsdatum im Zeitraum */
  adjustCents: number;
  /** erstattete Auslagen (aus eigener Tasche bezahlt, vom Chef genehmigt) */
  reimburseCents: number;
  reworks: number;
  ratingSum: number;
  ratingCount: number;
}

export interface FirmFinance {
  revenueCents: number;
  /** Lohnkosten (Festpreis + Stunden + Schichten + Prämien/Abzüge) */
  payoutCents: number;
  /** genehmigte Ausgaben/Material der abgenommenen Aufgaben */
  materialsCents: number;
  profitCents: number;
  perMember: Map<string, MemberEarnings>;
  doneTasks: Task[];
  entries: TimeEntry[];
  clientPrice: Map<string, number>;
  expensesByTask: Map<string, number>;
}

/**
 * Finanzen eines Zeitraums – gezählt wird NUR abgenommene Arbeit:
 * Aufgaben mit accepted_at im Zeitraum. Deren Festpreis, alle zugehörigen
 * Zeiteinträge (Stunden × Satz) und der Kundenpreis fallen in diesen Zeitraum.
 * Funktioniert für Chefs (ganze Firma) und – dank RLS – für Mitarbeiter (nur eigene Daten, ohne Kundenpreise).
 */
export async function loadFinance(ctx: Ctx, period: Period, opts: { memberId?: string } = {}): Promise<FirmFinance> {
  const { fromTs, toTs } = periodToRange(period);
  const fromDate = period.from, toDate = period.to;
  const { data: tasks } = await ctx.supabase
    .from("tasks")
    .select("*")
    .eq("firm_id", ctx.firm.id)
    .eq("status", "done")
    .gte("accepted_at", fromTs)
    .lt("accepted_at", toTs);
  const doneTasks = tasks ?? [];
  const ids = doneTasks.map((t) => t.id);

  let allEntries: TimeEntry[] = [];
  if (ids.length) {
    let eq = ctx.supabase.from("time_entries").select("*").in("task_id", ids);
    if (opts.memberId) eq = eq.eq("member_id", opts.memberId);
    allEntries = (await eq).data ?? [];
  }

  // Ausgaben der abgenommenen Aufgaben, Schichten (beendet im Zeitraum), Prämien/Abzüge (Datum im Zeitraum)
  let shiftQ = ctx.supabase.from("shifts").select("*").eq("firm_id", ctx.firm.id).gte("ended_at", fromTs).lt("ended_at", toTs);
  let adjQ = ctx.supabase.from("adjustments").select("*").eq("firm_id", ctx.firm.id).gte("effective_date", fromDate).lt("effective_date", toDate);
  if (opts.memberId) {
    shiftQ = shiftQ.eq("member_id", opts.memberId);
    adjQ = adjQ.eq("member_id", opts.memberId);
  }
  const [{ data: expenses }, { data: shifts }, { data: adjustments }] = await Promise.all([
    ids.length ? ctx.supabase.from("expenses").select("*").in("task_id", ids).eq("status", "approved") : Promise.resolve({ data: [] as Expense[] }),
    shiftQ,
    adjQ,
  ]);

  const clientPrice = new Map<string, number>();
  if (ctx.member.role === "boss" && ids.length) {
    const { data: fin } = await ctx.supabase.from("task_finance").select("task_id, client_price_cents").in("task_id", ids);
    for (const f of fin ?? []) clientPrice.set(f.task_id, f.client_price_cents);
  }

  const perMember = new Map<string, MemberEarnings>();
  const get = (id: string) => {
    let m = perMember.get(id);
    if (!m) {
      m = { memberId: id, minutes: 0, hourlyCents: 0, fixedCents: 0, totalCents: 0, tasksDone: 0, shiftMinutes: 0, shiftCents: 0, adjustCents: 0, reimburseCents: 0, reworks: 0, ratingSum: 0, ratingCount: 0 };
      perMember.set(id, m);
    }
    return m;
  };
  for (const t of doneTasks) {
    if (!t.assignee_id || (opts.memberId && t.assignee_id !== opts.memberId)) continue;
    const m = get(t.assignee_id);
    m.tasksDone += 1;
    m.fixedCents += t.fixed_pay_cents ?? 0;
    m.reworks += t.rework_count ?? 0;
    if (t.rating) {
      m.ratingSum += t.rating;
      m.ratingCount += 1;
    }
  }
  for (const e of allEntries) {
    const m = get(e.member_id);
    m.minutes += minutesBetween(e.started_at, e.ended_at);
    m.hourlyCents += entryPayCents(e);
  }
  for (const sh of shifts ?? []) {
    const m = get(sh.member_id);
    m.shiftMinutes += shiftNetMinutes(sh);
    m.shiftCents += shiftPayCents(sh);
  }
  for (const a of adjustments ?? []) get(a.member_id).adjustCents += a.amount_cents;
  const expensesByTask = new Map<string, number>();
  let materialsCents = 0;
  for (const e of expenses ?? []) {
    if (opts.memberId && e.member_id !== opts.memberId) continue;
    expensesByTask.set(e.task_id, (expensesByTask.get(e.task_id) ?? 0) + e.amount_cents);
    materialsCents += e.amount_cents;
    if (e.reimburse) get(e.member_id).reimburseCents += e.amount_cents;
  }
  let payoutCents = 0;
  for (const m of perMember.values()) {
    const labor = m.fixedCents + m.hourlyCents + m.shiftCents + m.adjustCents;
    m.totalCents = labor + m.reimburseCents;
    payoutCents += labor;
  }
  const revenueCents = [...clientPrice.values()].reduce((a, b) => a + b, 0);
  return {
    revenueCents,
    payoutCents,
    materialsCents,
    profitCents: revenueCents - payoutCents - materialsCents,
    perMember,
    doneTasks,
    entries: allEntries,
    clientPrice,
    expensesByTask,
  };
}

/** Noch nicht abgenommene Arbeit eines Mitarbeiters ("wartet auf Abnahme") */
export async function loadPending(ctx: Ctx, memberId: string): Promise<{ cents: number; minutes: number; tasks: number }> {
  const { data: tasks } = await ctx.supabase
    .from("tasks")
    .select("*")
    .eq("assignee_id", memberId)
    .in("status", ["in_progress", "review", "rework"]);
  const list = tasks ?? [];
  if (!list.length) return { cents: 0, minutes: 0, tasks: 0 };
  const { data: entries } = await ctx.supabase.from("time_entries").select("*").in("task_id", list.map((t) => t.id)).eq("member_id", memberId);
  let cents = 0;
  let minutes = 0;
  for (const e of entries ?? []) {
    cents += entryPayCents(e);
    minutes += minutesBetween(e.started_at, e.ended_at);
  }
  for (const t of list) if (t.status === "review") cents += t.fixed_pay_cents ?? 0;
  return { cents, minutes, tasks: list.length };
}

/** Alle Zeiteinträge zu Aufgaben, gruppiert */
export async function entriesByTask(ctx: Ctx, taskIds: string[]): Promise<Map<string, TimeEntry[]>> {
  if (!taskIds.length) return new Map();
  const { data } = await ctx.supabase.from("time_entries").select("*").in("task_id", taskIds);
  return groupBy(data ?? [], (e) => e.task_id);
}
