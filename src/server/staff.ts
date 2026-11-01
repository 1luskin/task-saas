import "server-only";
import type { Ctx } from "@/lib/auth";
import { minutesBetween } from "@/lib/dates";
import type { Task } from "@/lib/supabase/types";

/** Laufende/abgeschlossene eigene Zeit + Checklisten-Fortschritt pro Aufgabe */
export async function staffTaskExtras(ctx: Ctx, tasks: Task[]) {
  const ids = tasks.map((t) => t.id);
  const running = new Map<string, string>();
  const spent = new Map<string, number>();
  const progress = new Map<string, { done: number; total: number }>();
  if (!ids.length) return { running, spent, progress };
  const [{ data: entries }, { data: items }] = await Promise.all([
    ctx.supabase.from("time_entries").select("*").in("task_id", ids).eq("member_id", ctx.member.id),
    ctx.supabase.from("checklist_items").select("task_id, done").in("task_id", ids),
  ]);
  for (const e of entries ?? []) {
    if (!e.ended_at) running.set(e.task_id, e.started_at);
    else spent.set(e.task_id, (spent.get(e.task_id) ?? 0) + minutesBetween(e.started_at, e.ended_at));
  }
  for (const it of items ?? []) {
    const p = progress.get(it.task_id) ?? { done: 0, total: 0 };
    p.total++;
    if (it.done) p.done++;
    progress.set(it.task_id, p);
  }
  return { running, spent, progress };
}
