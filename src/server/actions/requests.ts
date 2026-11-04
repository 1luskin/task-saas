"use server";

import { assertFeature } from "@/lib/features";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBoss, assertMember, assertWritable } from "@/lib/auth";
import { ActionError, check, must, runAction } from "@/lib/action";
import { isoDate, moneyInput, optText, optUuid, priority, uuid } from "@/lib/validation";
import { notifyNewTask } from "@/server/notify";

const requestInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: optText(5000),
  address: optText(300),
  due_date: isoDate,
});

export async function createRequest(raw: z.input<typeof requestInput>) {
  return runAction(async () => {
    const ctx = await assertMember();
    await assertFeature(ctx, "requests");
    assertWritable(ctx);
    const input = requestInput.parse(raw);
    check(
      await ctx.supabase.from("task_requests").insert({
        firm_id: ctx.firm.id,
        created_by: ctx.member.id,
        ...input,
      }),
    );
    revalidatePath("/staff/profile");
    revalidatePath("/boss", "layout");
  });
}

const approveInput = z.object({
  assignee_id: optUuid,
  due_date: isoDate,
  priority: priority.default("normal"),
  client_price: moneyInput,
  fixed_pay: moneyInput,
});

export async function approveRequest(id: string, raw: z.input<typeof approveInput>) {
  return runAction(async () => {
    const ctx = await assertBoss();
    await assertFeature(ctx, "requests");
    assertWritable(ctx);
    uuid.parse(id);
    const input = approveInput.parse(raw);
    const req = check(await ctx.supabase.from("task_requests").select("*").eq("id", id).maybeSingle());
    if (!req || req.status !== "pending") throw new ActionError("invalid");

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
          title: req.title,
          description: req.description,
          address: req.address,
          due_date: input.due_date ?? req.due_date,
          assignee_id: input.assignee_id,
          priority: input.priority,
          fixed_pay_cents: fixedPay,
          created_by: ctx.member.id,
        })
        .select()
        .single(),
    );
    check(await ctx.supabase.from("task_finance").insert({ task_id: task.id, client_price_cents: input.client_price ?? 0 }));
    check(
      await ctx.supabase
        .from("task_requests")
        .update({ status: "approved", task_id: task.id, decided_by: ctx.member.id, decided_at: new Date().toISOString() })
        .eq("id", id),
    );
    if (task.assignee_id) {
      const a = task.assignee_id;
      after(() => notifyNewTask(a, task));
    }
    revalidatePath("/boss", "layout");
    return { taskId: task.id };
  });
}

export async function rejectRequest(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(
      await ctx.supabase
        .from("task_requests")
        .update({ status: "rejected", decided_by: ctx.member.id, decided_at: new Date().toISOString() })
        .eq("id", uuid.parse(id))
        .eq("status", "pending"),
    );
    revalidatePath("/boss", "layout");
  });
}

export async function deleteMyRequest(id: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    check(await ctx.supabase.from("task_requests").delete().eq("id", uuid.parse(id)));
    revalidatePath("/staff/profile");
  });
}
