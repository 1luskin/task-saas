"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBoss, assertMember, assertWritable } from "@/lib/auth";
import { ActionError, check, must, runAction } from "@/lib/action";
import { isoDate, moneyInput, optText, optUuid, priority, taskStatus, timeHHMM, uuid } from "@/lib/validation";
import { notifyAccepted, notifyNewTask, notifyRework } from "@/server/notify";
import { hit } from "@/lib/rate-limit";
import { requestReview } from "@/server/review-request";
import { resolveMentions } from "@/server/mentions";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPushToMembers } from "@/lib/push";

const taskInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: optText(5000),
  address: optText(300),
  assignee_id: optUuid,
  due_date: isoDate,
  due_time: timeHHMM,
  priority: priority.default("normal"),
  status: taskStatus.default("new"),
  client_price: moneyInput,
  fixed_pay: moneyInput,
  checklist: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
  client_id: optUuid,
});
export type TaskInput = z.input<typeof taskInput>;

function revalidateTasks() {
  revalidatePath("/boss", "layout");
  revalidatePath("/staff", "layout");
}

export async function createTask(raw: TaskInput) {
  return runAction(async () => {
    const ctx = await assertBoss();
    assertWritable(ctx);
    const input = taskInput.parse(raw);
    let fixedPay = input.fixed_pay;
    if (input.assignee_id) {
      const a = check(await ctx.supabase.from("members").select("pay_mode").eq("id", input.assignee_id).maybeSingle());
      if (!a) throw new ActionError("invalid");
      if (a.pay_mode === "hourly") fixedPay = null;
    }
    const task = must(
      await ctx.supabase
        .from("tasks")
        .insert({
          firm_id: ctx.firm.id,
          title: input.title,
          description: input.description,
          address: input.address,
          assignee_id: input.assignee_id,
          due_date: input.due_date,
          due_time: input.due_time,
          priority: input.priority,
          status: input.status,
          fixed_pay_cents: fixedPay,
          created_by: ctx.member.id,
          client_id: input.client_id,
        })
        .select()
        .single(),
    );
    check(await ctx.supabase.from("task_finance").insert({ task_id: task.id, client_price_cents: input.client_price ?? 0 }));
    if (input.checklist.length) {
      check(
        await ctx.supabase
          .from("checklist_items")
          .insert(input.checklist.map((text, position) => ({ task_id: task.id, text, position }))),
      );
    }
    if (task.assignee_id) {
      const assignee = task.assignee_id;
      after(() => notifyNewTask(assignee, task));
    }
    revalidateTasks();
    return { id: task.id };
  });
}

export async function updateTask(id: string, raw: TaskInput) {
  return runAction(async () => {
    const ctx = await assertBoss();
    uuid.parse(id);
    const input = taskInput.parse(raw);
    const before = check(await ctx.supabase.from("tasks").select("*").eq("id", id).maybeSingle());
    if (!before) throw new ActionError("forbidden");
    let fixedPay = input.fixed_pay;
    if (input.assignee_id) {
      const a = check(await ctx.supabase.from("members").select("pay_mode").eq("id", input.assignee_id).maybeSingle());
      if (!a) throw new ActionError("invalid");
      if (a.pay_mode === "hourly") fixedPay = null;
    }
    const task = must(
      await ctx.supabase
        .from("tasks")
        .update({
          title: input.title,
          description: input.description,
          address: input.address,
          assignee_id: input.assignee_id,
          due_date: input.due_date,
          due_time: input.due_time,
          priority: input.priority,
          status: input.status,
          fixed_pay_cents: fixedPay,
          client_id: input.client_id,
          // Neuer Termin → Überfällig-Meldung wieder erlauben
          overdue_notified_at: before.due_date !== input.due_date ? null : before.overdue_notified_at,
        })
        .eq("id", id)
        .select()
        .single(),
    );
    check(
      await ctx.supabase
        .from("task_finance")
        .upsert({ task_id: id, firm_id: ctx.firm.id, client_price_cents: input.client_price ?? 0 }),
    );
    if (task.assignee_id && task.assignee_id !== before.assignee_id) {
      const assignee = task.assignee_id;
      after(() => notifyNewTask(assignee, task));
    }
    revalidateTasks();
    return { id };
  });
}

export async function deleteTask(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    uuid.parse(id);
    const photos = check(await ctx.supabase.from("task_photos").select("storage_path").eq("task_id", id));
    if (photos?.length) await ctx.supabase.storage.from("task-photos").remove(photos.map((p) => p.storage_path));
    check(await ctx.supabase.from("tasks").delete().eq("id", id));
    revalidateTasks();
  });
}

export async function addChecklistItem(taskId: string, text: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    assertWritable(ctx);
    uuid.parse(taskId);
    const t = z.string().trim().min(1).max(300).parse(text);
    const { count } = await ctx.supabase.from("checklist_items").select("id", { count: "exact", head: true }).eq("task_id", taskId);
    check(await ctx.supabase.from("checklist_items").insert({ task_id: taskId, text: t, position: count ?? 0 }));
    revalidateTasks();
  });
}

export async function deleteChecklistItem(itemId: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    uuid.parse(itemId);
    check(await ctx.supabase.from("checklist_items").delete().eq("id", itemId));
    revalidateTasks();
  });
}

export async function addComment(taskId: string, body: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    assertWritable(ctx);
    uuid.parse(taskId);
    const text = z.string().trim().min(1).max(4000).parse(body);
    check(
      await ctx.supabase.from("task_comments").insert({
        task_id: taskId,
        author_id: ctx.member.id,
        author_name: ctx.member.full_name,
        body: text,
      }),
    );
    // @Erwähnungen: nur Personen, die die Aufgabe sehen dürfen (Chefs + Ausführender)
    if (text.includes("@")) {
      const firmId = ctx.firm.id;
      const author = ctx.member;
      after(async () => {
        const mentioned = await resolveMentions(firmId, taskId, text, author.id);
        if (mentioned.length) {
          const { data: task } = await createAdminClient().from("tasks").select("id, title").eq("id", taskId).single();
          await sendPushToMembers(mentioned, (t) => ({
            title: t("push.mention", { name: author.full_name }),
            body: `${task?.title ?? ""}: ${text.slice(0, 120)}`,
            url: `/boss/tasks/${taskId}`,
            tag: `mention-${taskId}`,
          }));
        }
      });
    }
    revalidateTasks();
  });
}

export async function deleteComment(id: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    uuid.parse(id);
    check(await ctx.supabase.from("task_comments").delete().eq("id", id));
    revalidateTasks();
  });
}

/** Nach direktem Upload in Storage: Datensatz anlegen. */
export async function registerPhoto(taskId: string, storagePath: string, kind: "general" | "before" | "after" = "general") {
  return runAction(async () => {
    const ctx = await assertMember();
    assertWritable(ctx);
    uuid.parse(taskId);
    if (!(await hit("upload", ctx.userId))) throw new ActionError("forbidden", "rate_limited");
    const path = z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i).parse(storagePath);
    if (!path.startsWith(`${ctx.firm.id}/${taskId}/`)) throw new ActionError("forbidden");
    check(await ctx.supabase.from("task_photos").insert({ task_id: taskId, storage_path: path, uploaded_by: ctx.member.id, kind: z.enum(["general", "before", "after"]).parse(kind) }));
    revalidateTasks();
  });
}

export async function deletePhoto(photoId: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    uuid.parse(photoId);
    const photo = check(await ctx.supabase.from("task_photos").select("*").eq("id", photoId).maybeSingle());
    if (!photo) throw new ActionError("forbidden");
    if (ctx.member.role !== "boss" && photo.uploaded_by !== ctx.member.id) throw new ActionError("forbidden");
    await ctx.supabase.storage.from("task-photos").remove([photo.storage_path]);
    check(await ctx.supabase.from("task_photos").delete().eq("id", photoId));
    revalidateTasks();
  });
}

/** Statuswechsel durch den Chef (online). Mitarbeiter nutzen /api/sync. */
export async function bossSetStatus(taskId: string, status: z.infer<typeof taskStatus>) {
  return runAction(async () => {
    const ctx = await assertBoss();
    uuid.parse(taskId);
    const next = taskStatus.parse(status);
    const task = must(await ctx.supabase.from("tasks").select("*").eq("id", taskId).maybeSingle());
    if (next === "done") return acceptInternal(ctx, task, null);
    check(await ctx.supabase.from("tasks").update({ status: next }).eq("id", taskId));
    revalidateTasks();
  });
}

async function acceptInternal(ctx: Awaited<ReturnType<typeof assertBoss>>, task: { id: string; title: string; assignee_id: string | null; status: string }, rating: number | null) {
  if (task.status === "done") return;
  const now = new Date().toISOString();
  check(
    await ctx.supabase
      .from("tasks")
      .update({ status: "done", accepted_at: now, accepted_by: ctx.member.id, completed_at: now, rating, accepted_via: "boss" })
      .eq("id", task.id),
  );
  // offene Zeiteinträge schließen (falls noch Timer lief)
  check(await ctx.supabase.from("time_entries").update({ ended_at: now }).eq("task_id", task.id).is("ended_at", null));
  if (task.assignee_id) {
    const a = task.assignee_id;
    after(() => notifyAccepted(a, task));
  }
  after(() => requestReview(task.id));
  revalidateTasks();
}

/** Arbeit abnehmen (+ optionale Bewertung 1–5). Erst danach zählt der Verdienst. */
export async function acceptTask(taskId: string, rating?: number | null) {
  return runAction(async () => {
    const ctx = await assertBoss();
    uuid.parse(taskId);
    const r = z.number().int().min(1).max(5).nullable().optional().parse(rating) ?? null;
    // IDOR-Schutz: Aufgabe muss über RLS in der eigenen Firma sichtbar sein
    const task = must(await ctx.supabase.from("tasks").select("*").eq("id", taskId).eq("firm_id", ctx.firm.id).maybeSingle());
    await acceptInternal(ctx, task, r);
  });
}

/** Zur Nacharbeit zurückgeben – Kommentar ist Pflicht und wird in den Verlauf geschrieben. */
export async function returnTask(taskId: string, comment: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    uuid.parse(taskId);
    const text = z.string().trim().min(3).max(4000).parse(comment);
    const task = must(await ctx.supabase.from("tasks").select("*").eq("id", taskId).eq("firm_id", ctx.firm.id).maybeSingle());
    if (task.status !== "review" && task.status !== "done") throw new ActionError("invalid");
    check(await ctx.supabase.from("tasks").update({ status: "rework" }).eq("id", taskId));
    check(
      await ctx.supabase.from("task_comments").insert({
        task_id: taskId,
        author_id: ctx.member.id,
        author_name: ctx.member.full_name,
        body: text,
      }),
    );
    if (task.assignee_id) {
      const a = task.assignee_id;
      after(() => notifyRework(a, task, text));
    }
    revalidateTasks();
  });
}
