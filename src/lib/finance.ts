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
 * Finanzen eines Zeitraums.
 * - Umsatz: Kundenpreis der im Zeitraum erledigten Aufgaben
 * - Auszahlung: Festpreise erledigter Aufgaben + Stundenlohn der im Zeitraum begonnenen Zeiteinträge
 * Funktioniert für Chefs (ganze Firma) und – dank RLS – für Mitarbeiter (nur eigene Daten, ohne Kundenpreise).
 */
export async function loadFinance(ctx: Ctx, period: Period, opts: { memberId?: string } = {}): Promise<FirmFinance> {
  const { fromTs, toTs } = periodToRange(period);
  let tq = ctx.supabase
    .from("tasks")
    .select("*")
    .eq("firm_id", ctx.firm.id)
    .eq("status", "done")
    .gte("completed_at", fromTs)
    .lt("completed_at", toTs);
  if (opts.memberId) tq = tq.eq("assignee_id", opts.memberId);
  let eq = ctx.supabase
    .from("time_entries")
    .select("*")
    .eq("firm_id", ctx.firm.id)
    .gte("started_at", fromTs)
    .lt("started_at", toTs);
  if (opts.memberId) eq = eq.eq("member_id", opts.memberId);

  const [{ data: tasks }, { data: entries }] = await Promise.all([tq, eq]);
  const doneTasks = tasks ?? [];
  const allEntries = entries ?? [];

  const clientPrice = new Map<string, number>();
  if (ctx.member.role === "boss" && doneTasks.length) {
    const { data: fin } = await ctx.supabase
      .from("task_finance")
      .select("task_id, client_price_cents")
      .in("task_id", doneTasks.map((t) => t.id));
    for (const f of fin ?? []) clientPrice.set(f.task_id, f.client_price_cents);
  }

  const perMember = new Map<string, MemberEarnings>();
  const get = (id: string) => {
    let m = perMember.get(id);
    if (!m) {
      m = { memberId: id, minutes: 0, hourlyCents: 0, fixedCents: 0, totalCents: 0, tasksDone: 0 };
      perMember.set(id, m);
    }
    return m;
  };
  for (const t of doneTasks) {
    if (!t.assignee_id) continue;
    const m = get(t.assignee_id);
    m.tasksDone += 1;
    m.fixedCents += t.fixed_pay_cents ?? 0;
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

/** Alle Zeiteinträge zu Aufgaben, gruppiert */
export async function entriesByTask(ctx: Ctx, taskIds: string[]): Promise<Map<string, TimeEntry[]>> {
  if (!taskIds.length) return new Map();
  const { data } = await ctx.supabase.from("time_entries").select("*").in("task_id", taskIds);
  return groupBy(data ?? [], (e) => e.task_id);
}
