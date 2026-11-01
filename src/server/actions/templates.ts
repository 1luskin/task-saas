"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBoss } from "@/lib/auth";
import { check, must, runAction } from "@/lib/action";
import { moneyInput, optText, optUuid, priority, uuid } from "@/lib/validation";

const templateInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: optText(5000),
    address: optText(300),
    assignee_id: optUuid,
    priority: priority.default("normal"),
    recurrence: z.enum(["daily", "weekly", "monthly"]),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
    month_day: z.number().int().min(1).max(31).nullable().default(null),
    client_price: moneyInput,
    fixed_pay: moneyInput,
    checklist: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
    active: z.boolean().default(true),
  })
  .refine((v) => v.recurrence !== "weekly" || v.weekdays.length > 0, { message: "weekdays required" })
  .refine((v) => v.recurrence !== "monthly" || v.month_day !== null, { message: "month_day required" });

export type TemplateInput = z.input<typeof templateInput>;

export async function saveTemplate(id: string | null, raw: TemplateInput) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const input = templateInput.parse(raw);
    const row = {
      firm_id: ctx.firm.id,
      title: input.title,
      description: input.description,
      address: input.address,
      assignee_id: input.assignee_id,
      priority: input.priority,
      recurrence: input.recurrence,
      weekdays: [...new Set(input.weekdays)].sort(),
      month_day: input.recurrence === "monthly" ? input.month_day : null,
      client_price_cents: input.client_price,
      fixed_pay_cents: input.fixed_pay,
      checklist: input.checklist,
      active: input.active,
    };
    if (id) check(await ctx.supabase.from("task_templates").update(row).eq("id", uuid.parse(id)));
    else check(await ctx.supabase.from("task_templates").insert(row));
    revalidatePath("/boss/templates");
  });
}

export async function deleteTemplate(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("task_templates").delete().eq("id", uuid.parse(id)));
    revalidatePath("/boss/templates");
  });
}

export async function setTemplateActive(id: string, active: boolean) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("task_templates").update({ active: z.boolean().parse(active) }).eq("id", uuid.parse(id)));
    revalidatePath("/boss/templates");
  });
}
