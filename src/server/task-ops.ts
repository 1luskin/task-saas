import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { assertWritable, type Ctx } from "@/lib/auth";
import { ActionError, check } from "@/lib/action";
import { notifyTaskReview } from "./notify";
import { staffCanTransition } from "@/lib/workflow";
import { isEnabled } from "@/lib/features";
import { withinGeofence } from "@/lib/geo";
import { todayISO } from "@/lib/dates";

/** Operationen, die Mitarbeiter auch offline ausführen können (siehe /api/sync). */
const geo = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), acc: z.number().min(0).max(100000).nullable().optional() }).optional();

export const syncOpSchema = z.discriminatedUnion("op", [
  // "done" ist hier bewusst NICHT erlaubt – Abnahme nur über acceptTask (Chef) bzw. Auto-Abnahme
  z.object({ op: z.literal("status"), taskId: z.string().uuid(), status: z.enum(["new", "in_progress", "review"]), at: z.string().datetime() }),
  z.object({ op: z.literal("checklist"), itemId: z.string().uuid(), done: z.boolean(), at: z.string().datetime() }),
  z.object({ op: z.literal("start"), taskId: z.string().uuid(), entryId: z.string().uuid(), at: z.string().datetime(), geo }),
  z.object({ op: z.literal("finish"), taskId: z.string().uuid(), at: z.string().datetime(), geo }),
  // Schichten (offline-fähig, id vom Client → idempotent)
  z.object({ op: z.literal("shift_start"), shiftId: z.string().uuid(), at: z.string().datetime(), geo }),
  z.object({ op: z.literal("shift_pause"), shiftId: z.string().uuid(), at: z.string().datetime() }),
  z.object({ op: z.literal("shift_resume"), shiftId: z.string().uuid(), at: z.string().datetime() }),
  z.object({ op: z.literal("shift_end"), shiftId: z.string().uuid(), at: z.string().datetime(), geo }),
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

type Geo = { lat: number; lng: number; acc?: number | null } | undefined;

/** Standortpunkt speichern – nur wenn Funktion aktiv; Einwilligung prüft die DB (RLS). Fehler blockieren nie die Arbeit. */
async function saveGeo(ctx: Ctx, g: Geo, kind: "task_start" | "task_finish" | "shift_start" | "shift_end", ref: { taskId?: string; shiftId?: string }) {
  if (!g || !(await isEnabled(ctx, "geolocation"))) return;
  await ctx.supabase.from("geo_points").insert({
    firm_id: ctx.firm.id, member_id: ctx.member.id, kind, task_id: ref.taskId ?? null, shift_id: ref.shiftId ?? null,
    lat: g.lat, lng: g.lng, accuracy_m: g.acc != null ? Math.round(g.acc) : null,
  });
}

/** Geozone beim Schichtbeginn: in der Nähe eines heutigen Objekts (Koordinaten der Aufgaben) */
async function assertGeofence(ctx: Ctx, g: Geo) {
  const radius = ctx.firm.geofence_radius_m;
  if (!radius || !(await isEnabled(ctx, "geolocation"))) return;
  const { data: tasks } = await ctx.supabase.from("tasks").select("lat, lng").eq("assignee_id", ctx.member.id).eq("due_date", todayISO()).neq("status", "done");
  const targets = (tasks ?? []).filter((t) => t.lat != null && t.lng != null);
  if (!targets.length) return;
  if (!g || !withinGeofence(g, targets, radius)) throw new ActionError("forbidden", "geofence");
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
      await saveGeo(ctx, op.geo, "task_start", { taskId: op.taskId });
      if (task.status !== "in_progress") {
        // new/rework → in_progress (vom Trigger geprüft)
        check(await ctx.supabase.from("tasks").update({ status: "in_progress" }).eq("id", op.taskId));
      }
      return;
    }
    case "finish":
      await submitForReview(ctx, op.taskId, clampTs(op.at));
      return saveGeo(ctx, op.geo, "task_finish", { taskId: op.taskId });
    case "shift_start": {
      assertWritable(ctx);
      const existing = check(await ctx.supabase.from("shifts").select("id").eq("id", op.shiftId).maybeSingle());
      if (existing) return;
      await assertGeofence(ctx, op.geo);
      check(await ctx.supabase.from("shifts").insert({ id: op.shiftId, firm_id: ctx.firm.id, member_id: ctx.member.id, started_at: clampTs(op.at) }));
      return saveGeo(ctx, op.geo, "shift_start", { shiftId: op.shiftId });
    }
    case "shift_pause":
    case "shift_resume":
    case "shift_end": {
      const sh = check(await ctx.supabase.from("shifts").select("*").eq("id", op.shiftId).eq("member_id", ctx.member.id).maybeSingle());
      if (!sh) throw new ActionError("forbidden");
      if (sh.ended_at) return; // schon beendet (z. B. Auto-Ende) → idempotent
      const at = clampTs(op.at);
      const pausedMin = sh.break_started_at ? Math.max(0, Math.round((new Date(at).getTime() - new Date(sh.break_started_at).getTime()) / 60000)) : 0;
      if (op.op === "shift_pause") {
        if (sh.break_started_at) return;
        check(await ctx.supabase.from("shifts").update({ break_started_at: at }).eq("id", sh.id));
      } else if (op.op === "shift_resume") {
        if (!sh.break_started_at) return;
        check(await ctx.supabase.from("shifts").update({ break_started_at: null, break_minutes: sh.break_minutes + pausedMin }).eq("id", sh.id));
      } else {
        const end = at < sh.started_at ? sh.started_at : at;
        check(await ctx.supabase.from("shifts").update({ ended_at: end, break_started_at: null, break_minutes: sh.break_minutes + pausedMin }).eq("id", sh.id));
        await saveGeo(ctx, op.op === "shift_end" ? op.geo : undefined, "shift_end", { shiftId: sh.id });
      }
      return;
    }
  }
}
