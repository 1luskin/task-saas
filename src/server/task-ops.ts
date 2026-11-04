import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { assertWritable, type Ctx } from "@/lib/auth";
import { ActionError, check } from "@/lib/action";
import { notifyTaskReview } from "./notify";
import { staffCanTransition } from "@/lib/workflow";

/** Operationen, die Mitarbeiter auch offline ausführen können (siehe /api/sync). */
export const syncOpSchema = z.discriminatedUnion("op", [
  // "done" ist hier bewusst NICHT erlaubt – Abnahme nur über acceptTask (Chef) bzw. Auto-Abnahme
  z.object({ op: z.literal("status"), taskId: z.string().uuid(), status: z.enum(["new", "in_progress", "review"]), at: z.string().datetime() }),
  z.object({ op: z.literal("checklist"), itemId: z.string().uuid(), done: z.boolean(), at: z.string().datetime() }),
  z.object({ op: z.literal("start"), taskId: z.string().uuid(), entryId: z.string().uuid(), at: z.string().datetime() }),
  z.object({ op: z.literal("finish"), taskId: z.string().uuid(), at: z.string().datetime() }),
]);
export type SyncOp = z.infer<typeof syncOpSchema>;

/** Client-Zeitstempel übernehmen, aber nie in der Zukunft und max. 7 Tage alt. */
function clampTs(at: string): string {
  const now = Date.now();
  const t = Math.min(new Date(at).getTime(), now);
  return new Date(Math.max(t, now - 7 * 24 * 3600 * 1000)).toISOString();
}

async function loadTask(ctx: Ctx, taskId: string) {
  // RLS: Mitarbeiter sieht nur eigene Aufgaben → sonst "nicht gefunden"
  const task = check(await ctx.supabase.from("tasks").select("*").eq("id", taskId).maybeSingle());
  if (!task) throw new ActionError("forbidden");
  return task;
}

async function closeOpenEntries(ctx: Ctx, filter: { taskId?: string }, endedAt: string) {
  let q = ctx.supabase
    .from("time_entries")
    .select("id, started_at")
    .eq("member_id", ctx.member.id)
    .is("ended_at", null);
  if (filter.taskId) q = q.eq("task_id", filter.taskId);
  const open = check(await q);
  for (const e of open ?? []) {
    const end = endedAt < e.started_at ? e.started_at : endedAt;
    check(await ctx.supabase.from("time_entries").update({ ended_at: end }).eq("id", e.id));
  }
}

/** "Fertig": Timer stoppen, zur Prüfung abgeben, Chef benachrichtigen */
async function submitForReview(ctx: Ctx, taskId: string, at: string) {
  const task = await loadTask(ctx, taskId);
  if (task.status === "review" || task.status === "done") return; // idempotent
  if (ctx.member.role !== "boss" && !staffCanTransition(task.status, "review")) throw new ActionError("forbidden");
  await closeOpenEntries(ctx, { taskId }, at);
  check(await ctx.supabase.from("tasks").update({ status: "review" }).eq("id", taskId));
  after(() => notifyTaskReview(ctx.firm.id, task, ctx.member.full_name));
}

export async function applyOp(ctx: Ctx, op: SyncOp): Promise<void> {
  switch (op.op) {
    case "status": {
      const at = clampTs(op.at);
      if (op.status === "review") return submitForReview(ctx, op.taskId, at);
      const task = await loadTask(ctx, op.taskId);
      if (task.status === op.status) return;
      if (ctx.member.role !== "boss" && !staffCanTransition(task.status, op.status)) throw new ActionError("forbidden");
      if (op.status === "new") await closeOpenEntries(ctx, { taskId: op.taskId }, at);
      check(await ctx.supabase.from("tasks").update({ status: op.status }).eq("id", op.taskId));
      return;
    }
    case "checklist": {
      const res = check(
        await ctx.supabase.from("checklist_items").update({ done: op.done }).eq("id", op.itemId).select("id"),
      );
      if (!res?.length) throw new ActionError("forbidden");
      return;
    }
    case "start": {
      assertWritable(ctx);
      const at = clampTs(op.at);
      const task = await loadTask(ctx, op.taskId);
      if (ctx.member.role !== "boss" && task.assignee_id !== ctx.member.id) throw new ActionError("forbidden");
      if (task.status === "review" || task.status === "done") throw new ActionError("forbidden");
      // Idempotent: gleicher Eintrag schon vorhanden?
      const existing = check(await ctx.supabase.from("time_entries").select("id").eq("id", op.entryId).maybeSingle());
      if (existing) return;
      // Man arbeitet immer nur an einer Aufgabe gleichzeitig
      await closeOpenEntries(ctx, {}, at);
      check(
        await ctx.supabase.from("time_entries").insert({
          id: op.entryId,
          task_id: op.taskId,
          member_id: ctx.member.id,
          started_at: at,
        }),
      );
      if (task.status !== "in_progress") {
        // new/rework → in_progress (vom Trigger geprüft)
        check(await ctx.supabase.from("tasks").update({ status: "in_progress" }).eq("id", op.taskId));
      }
      return;
    }
    case "finish":
      return submitForReview(ctx, op.taskId, clampTs(op.at));
  }
}
