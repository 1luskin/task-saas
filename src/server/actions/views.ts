"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertBoss, assertMember, assertWritable } from "@/lib/auth";
import { ActionError, check, must, runAction } from "@/lib/action";
import { assertFeature } from "@/lib/features";
import { isoDate, optUuid, taskStatus, uuid } from "@/lib/validation";
import { hit } from "@/lib/rate-limit";
import { notifyNewTask } from "@/server/notify";
import type { Task } from "@/lib/supabase/types";

const refresh = () => {
  revalidatePath("/boss", "layout");
  revalidatePath("/staff", "layout");
};
const ids = z.array(uuid).min(1).max(200);

export async function setPinned(taskId: string, pinned: boolean) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("tasks").update({ pinned: z.boolean().parse(pinned) }).eq("id", uuid.parse(taskId)).eq("firm_id", ctx.firm.id));
    refresh();
  });
}

/** Massenänderung: Ausführender, Termin, Status (nur eigene Firma; Trigger prüfen Verfügbarkeit) */
export async function bulkUpdate(taskIds: string[], raw: { assignee_id?: string | null; due_date?: string | null; status?: string }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const list = ids.parse(taskIds);
    const p = z.object({ assignee_id: optUuid.optional(), due_date: isoDate.optional(), status: taskStatus.optional() }).parse(raw);
    const patch: Partial<Task> = {};
    if (raw.assignee_id !== undefined) patch.assignee_id = p.assignee_id ?? null;
    if (raw.due_date !== undefined) patch.due_date = p.due_date ?? null;
    if (p.status) patch.status = p.status;
    if (!Object.keys(patch).length) return;
    check(await ctx.supabase.from("tasks").update(patch).in("id", list).eq("firm_id", ctx.firm.id));
    if (p.assignee_id) {
      const assignee = p.assignee_id;
      const { data: tasks } = await ctx.supabase.from("tasks").select("id, title, priority").in("id", list);
      after(async () => { for (const t of tasks ?? []) await notifyNewTask(assignee, t); });
    }
    refresh();
  });
}

export async function bulkDelete(taskIds: string[]) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const list = ids.parse(taskIds);
    check(await ctx.supabase.from("tasks").delete().in("id", list).eq("firm_id", ctx.firm.id));
    refresh();
  });
}

/** Aufgabe duplizieren (inkl. Checkliste und Kundenpreis, ohne Zeiten/Fotos/Kommentare) */
export async function duplicateTasks(taskIds: string[]) {
  return runAction(async () => {
    const ctx = await assertBoss();
    assertWritable(ctx);
    const list = ids.parse(taskIds);
    const { data: tasks } = await ctx.supabase.from("tasks").select("*").in("id", list).eq("firm_id", ctx.firm.id);
    let last = "";
    for (const t of tasks ?? []) {
      const copy = must(
        await ctx.supabase
          .from("tasks")
          .insert({
            firm_id: ctx.firm.id, title: t.title, description: t.description, address: t.address, assignee_id: null,
            due_date: t.due_date, due_time: t.due_time, priority: t.priority, fixed_pay_cents: t.fixed_pay_cents,
            client_id: t.client_id, created_by: ctx.member.id,
          })
          .select("id")
          .single(),
      );
      last = copy.id;
      const [{ data: fin }, { data: items }] = await Promise.all([
        ctx.supabase.from("task_finance").select("client_price_cents").eq("task_id", t.id).maybeSingle(),
        ctx.supabase.from("checklist_items").select("text, position").eq("task_id", t.id),
      ]);
      check(await ctx.supabase.from("task_finance").insert({ task_id: copy.id, client_price_cents: fin?.client_price_cents ?? 0 }));
      if (items?.length) check(await ctx.supabase.from("checklist_items").insert(items.map((i) => ({ task_id: copy.id, text: i.text, position: i.position }))));
    }
    refresh();
    return { id: last };
  });
}

/** Kalender: Aufgabe auf anderen Tag ziehen */
export async function moveTaskDate(taskId: string, date: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const d = isoDate.parse(date);
    if (!d) throw new ActionError("invalid");
    check(await ctx.supabase.from("tasks").update({ due_date: d }).eq("id", uuid.parse(taskId)).eq("firm_id", ctx.firm.id));
    refresh();
  });
}

/** Kanban: Spalte = Status der Firma (eigener Status bestimmt die Etappe) */
export async function moveTaskToStatus(taskId: string, statusId: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    await assertFeature(ctx, "kanban");
    const st = must(await ctx.supabase.from("task_statuses").select("*").eq("id", uuid.parse(statusId)).eq("firm_id", ctx.firm.id).maybeSingle());
    const id = uuid.parse(taskId);
    if (st.is_system) check(await ctx.supabase.from("tasks").update({ status: st.kind, custom_status_id: null }).eq("id", id).eq("firm_id", ctx.firm.id));
    else check(await ctx.supabase.from("tasks").update({ custom_status_id: st.id }).eq("id", id).eq("firm_id", ctx.firm.id));
    refresh();
  });
}

// --- Checklisten-Vorlagen ---------------------------------------------------------
export async function saveChecklistTemplate(raw: { name: string; items: string }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    assertWritable(ctx);
    const name = z.string().trim().min(1).max(80).parse(raw.name);
    const items = raw.items.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 100).map((s) => z.string().max(300).parse(s));
    check(await ctx.supabase.from("checklist_templates").insert({ firm_id: ctx.firm.id, name, items }));
    revalidatePath("/boss", "layout");
  });
}

export async function deleteChecklistTemplate(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("checklist_templates").delete().eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id));
    revalidatePath("/boss", "layout");
  });
}

export async function applyChecklistTemplate(taskId: string, templateId: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const tpl = must(await ctx.supabase.from("checklist_templates").select("*").eq("id", uuid.parse(templateId)).eq("firm_id", ctx.firm.id).maybeSingle());
    const tid = uuid.parse(taskId);
    const { count } = await ctx.supabase.from("checklist_items").select("id", { count: "exact", head: true }).eq("task_id", tid);
    if (tpl.items.length) check(await ctx.supabase.from("checklist_items").insert(tpl.items.map((text, i) => ({ task_id: tid, text, position: (count ?? 0) + i }))));
    refresh();
  });
}

// --- Dateien ----------------------------------------------------------------------
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/msword", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

/** Dateiname säubern (keine Pfade/Steuerzeichen) */
export async function sanitizeFileName(name: string): Promise<string> {
  return name.normalize("NFC").replace(/[\\/\u0000-\u001f<>:"|?*]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "datei";
}

export async function registerFile(raw: { taskId: string; path: string; name: string; mime: string; size: number; commentId?: string | null }) {
  return runAction(async () => {
    const ctx = await assertMember();
    assertWritable(ctx);
    if (!(await hit("upload", ctx.userId))) throw new ActionError("forbidden", "rate_limited");
    const input = z
      .object({
        taskId: uuid, path: z.string().max(400), name: z.string().min(1).max(200), mime: z.enum(ALLOWED as [string, ...string[]]),
        size: z.number().int().min(1).max(10 * 1024 * 1024), commentId: optUuid.optional(),
      })
      .parse(raw);
    if (!input.path.startsWith(`${ctx.firm.id}/${input.taskId}/`) || input.path.includes("..")) throw new ActionError("forbidden");
    check(
      await ctx.supabase.from("task_files").insert({
        task_id: input.taskId, storage_path: input.path, file_name: await sanitizeFileName(input.name), mime_type: input.mime,
        size_bytes: input.size, uploaded_by: ctx.member.id, comment_id: input.commentId ?? null,
      }),
    );
    refresh();
  });
}

export async function deleteFile(id: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    const f = must(await ctx.supabase.from("task_files").select("*").eq("id", uuid.parse(id)).maybeSingle());
    await ctx.supabase.storage.from("task-files").remove([f.storage_path]);
    check(await ctx.supabase.from("task_files").delete().eq("id", f.id));
    refresh();
  });
}
