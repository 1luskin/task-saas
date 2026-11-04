import "server-only";
import type { Ctx } from "@/lib/auth";
import { entryPayCents } from "@/lib/earnings";

/** Umsatz/Gewinn je Kunde aus abgenommenen Aufgaben (Lohn = Festpreis + Stunden; Material = genehmigte Ausgaben) */
export async function clientStats(ctx: Ctx, clientIds?: string[]) {
  let q = ctx.supabase.from("tasks").select("*").eq("firm_id", ctx.firm.id).eq("status", "done").not("client_id", "is", null);
  if (clientIds?.length) q = q.in("client_id", clientIds);
  const { data: tasks } = await q;
  const list = tasks ?? [];
  const ids = list.map((t) => t.id);
  const [{ data: fin }, { data: entries }, { data: exp }] = ids.length
    ? await Promise.all([
        ctx.supabase.from("task_finance").select("*").in("task_id", ids),
        ctx.supabase.from("time_entries").select("*").in("task_id", ids),
        ctx.supabase.from("expenses").select("*").in("task_id", ids).eq("status", "approved"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const out = new Map<string, { revenue: number; profit: number; tasks: number }>();
  for (const t of list) {
    const cur = out.get(t.client_id!) ?? { revenue: 0, profit: 0, tasks: 0 };
    const revenue = fin?.find((f) => f.task_id === t.id)?.client_price_cents ?? 0;
    const labor = (t.fixed_pay_cents ?? 0) + (entries ?? []).filter((e) => e.task_id === t.id).reduce((s, e) => s + entryPayCents(e), 0);
    const material = (exp ?? []).filter((e) => e.task_id === t.id).reduce((s, e) => s + e.amount_cents, 0);
    cur.revenue += revenue;
    cur.profit += revenue - labor - material;
    cur.tasks += 1;
    out.set(t.client_id!, cur);
  }
  return out;
}
