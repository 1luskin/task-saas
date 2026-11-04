"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBoss } from "@/lib/auth";
import { check, must, runAction } from "@/lib/action";
import { uuid } from "@/lib/validation";

const color = z.enum(["slate", "blue", "amber", "red", "green", "violet", "teal"]);
const kind = z.enum(["new", "in_progress", "review", "rework", "done"]);

export async function saveTaskStatus(id: string | null, raw: { name: string; color: string; kind?: string; position?: number }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const input = z.object({ name: z.string().trim().min(1).max(40), color, kind: kind.optional(), position: z.number().int().min(0).max(999).optional() }).parse(raw);
    if (id) {
      // Etappe eines bestehenden Status ändert sich nicht (Systemstatus: per Trigger gesperrt)
      check(await ctx.supabase.from("task_statuses").update({ name: input.name, color: input.color, ...(input.position != null ? { position: input.position } : {}) }).eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id));
    } else {
      const { count } = await ctx.supabase.from("task_statuses").select("id", { count: "exact", head: true }).eq("firm_id", ctx.firm.id);
      if ((count ?? 0) >= 20) throw new Error("too many statuses");
      check(await ctx.supabase.from("task_statuses").insert({ firm_id: ctx.firm.id, name: input.name, color: input.color, kind: input.kind ?? "in_progress", position: count ?? 0 }));
    }
    revalidatePath("/boss", "layout");
  });
}

export async function deleteTaskStatus(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const st = must(await ctx.supabase.from("task_statuses").select("*").eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id).maybeSingle());
    if (st.is_system) throw new Error("system status");
    check(await ctx.supabase.from("task_statuses").delete().eq("id", st.id));
    revalidatePath("/boss", "layout");
  });
}

/** Reihenfolge der Spalten (Kanban) */
export async function reorderTaskStatuses(ids: string[]) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const list = z.array(uuid).max(20).parse(ids);
    for (const [i, sid] of list.entries()) {
      check(await ctx.supabase.from("task_statuses").update({ position: i }).eq("id", sid).eq("firm_id", ctx.firm.id));
    }
    revalidatePath("/boss", "layout");
  });
}

export async function setAutoAcceptDays(days: number | null) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const d = z.number().int().min(1).max(60).nullable().parse(days);
    check(await ctx.supabase.from("firms").update({ auto_accept_days: d }).eq("id", ctx.firm.id));
    revalidatePath("/boss", "layout");
  });
}
