import "server-only";
import type { Ctx } from "./auth";
import { periodToRange, type Period } from "./dates";
import { entryPayCents, groupBy } from "./earnings";
import { minutesBetween } from "./dates";
import type { Task, TimeEntry } from "./supabase/types";

export interface MemberEarnings {
  memberId: string;
  minutes: number;
  hourlyCents: number;
  fixedCents: number;
  totalCents: number;
  tasksDone: number;
  reworks: number;
  ratingSum: number;
  ratingCount: number;
}

export interface FirmFinance {
  revenueCents: number;
  payoutCents: number;
  profitCents: number;
  perMember: Map<string, MemberEarnings>;
  doneTasks: Task[];
  entries: TimeEntry[];
  clientPrice: Map<string, number>;
}

/**
 * Finanzen eines Zeitraums – gezählt wird NUR abgenommene Arbeit:
 * Aufgaben mit accepted_at im Zeitraum. Deren Festpreis, alle zugehörigen
 * Zeiteinträge (Stunden × Satz) und der Kundenpreis fallen in diesen Zeitraum.
 * Funktioniert für Chefs (ganze Firma) und – dank RLS – für Mitarbeiter (nur eigene Daten, ohne Kundenpreise).
 */
export async function loadFinance(ctx: Ctx, period: Period, opts: { memberId?: string } = {}): Promise<FirmFinance> {
  const { fromTs, toTs } = periodToRange(period);
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

  const clientPrice = new Map<string, number>();
  if (ctx.member.role === "boss" && ids.length) {
    const { data: fin } = await ctx.supabase.from("task_finance").select("task_id, client_price_cents").in("task_id", ids);
    for (const f of fin ?? []) clientPrice.set(f.task_id, f.client_price_cents);
  }

  const perMember = new Map<string, MemberEarnings>();
  const get = (id: string) => {
    let m = perMember.get(id);
    if (!m) {
      m = { memberId: id, minutes: 0, hourlyCents: 0, fixedCents: 0, totalCents: 0, tasksDone: 0, reworks: 0, ratingSum: 0, ratingCount: 0 };
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
  let payoutCents = 0;
  for (const m of perMember.values()) {
    m.totalCents = m.fixedCents + m.hourlyCents;
    payoutCents += m.totalCents;
  }
  const revenueCents = [...clientPrice.values()].reduce((a, b) => a + b, 0);
  return { revenueCents, payoutCents, profitCents: revenueCents - payoutCents, perMember, doneTasks, entries: allEntries, clientPrice };
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
