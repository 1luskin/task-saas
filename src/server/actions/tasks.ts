"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBoss, assertMember } from "@/lib/auth";
import { ActionError, check, must, runAction } from "@/lib/action";
import { isoDate, moneyInput, optText, optUuid, priority, taskStatus, timeHHMM, uuid } from "@/lib/validation";
import { notifyNewTask } from "@/server/notify";
import { applyOp } from "@/server/task-ops";

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
});
export type TaskInput = z.input<typeof taskInput>;

function revalidateTasks() {
  revalidatePath("/boss", "layout");
  revalidatePath("/staff", "layout");
}

export async function createTask(raw: TaskInput) {
  return runAction(async () => {
    const ctx = await assertBoss();
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
export async function registerPhoto(taskId: string, storagePath: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    uuid.parse(taskId);
    const path = z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i).parse(storagePath);
    if (!path.startsWith(`${ctx.firm.id}/${taskId}/`)) throw new ActionError("forbidden");
    check(await ctx.supabase.from("task_photos").insert({ task_id: taskId, storage_path: path, uploaded_by: ctx.member.id }));
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
    await applyOp(ctx, { op: "status", taskId: uuid.parse(taskId), status: taskStatus.parse(status), at: new Date().toISOString() });
    revalidateTasks();
  });
}
