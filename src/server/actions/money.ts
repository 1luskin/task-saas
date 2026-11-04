"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBoss, assertMember, assertWritable } from "@/lib/auth";
import { ActionError, check, must, runAction } from "@/lib/action";
import { assertFeature } from "@/lib/features";
import { isoDate, moneyInput, optUuid, uuid } from "@/lib/validation";
import { pickAssignee } from "@/lib/shifts";
import { hit } from "@/lib/rate-limit";

const refresh = () => {
  revalidatePath("/boss", "layout");
  revalidatePath("/staff", "layout");
};

/** Ausgabe zur Aufgabe (Mitarbeiter oder Chef). Beleg wurde vorher in "receipts" hochgeladen. */
export async function createExpense(raw: { taskId: string; amount: string; description: string; reimburse: boolean; receiptPath?: string | null }) {
  return runAction(async () => {
    const ctx = await assertMember();
    assertWritable(ctx);
    await assertFeature(ctx, "expenses");
    const input = z
      .object({
        taskId: uuid,
        amount: moneyInput,
        description: z.string().trim().min(1).max(300),
        reimburse: z.boolean(),
        receiptPath: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i).nullable().optional(),
      })
      .parse(raw);
    if (!input.amount || input.amount <= 0) throw new ActionError("invalid");
    if (input.receiptPath && !input.receiptPath.startsWith(`${ctx.firm.id}/${input.taskId}/`)) throw new ActionError("forbidden");
    if (input.receiptPath && !(await hit("upload", ctx.userId))) throw new ActionError("forbidden", "rate_limited");
    check(
      await ctx.supabase.from("expenses").insert({
        task_id: input.taskId,
        member_id: ctx.member.id,
        amount_cents: input.amount,
        description: input.description,
        reimburse: input.reimburse,
        receipt_path: input.receiptPath ?? null,
      }),
    );
    refresh();
  });
}

export async function decideExpense(id: string, approve: boolean) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(
      await ctx.supabase
        .from("expenses")
        .update({ status: approve ? "approved" : "rejected", decided_by: ctx.member.id, decided_at: new Date().toISOString() })
        .eq("id", uuid.parse(id))
        .eq("firm_id", ctx.firm.id),
    );
    refresh();
  });
}

export async function deleteExpense(id: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    const e = must(await ctx.supabase.from("expenses").select("*").eq("id", uuid.parse(id)).maybeSingle());
    if (e.receipt_path) await ctx.supabase.storage.from("receipts").remove([e.receipt_path]);
    check(await ctx.supabase.from("expenses").delete().eq("id", e.id));
    refresh();
  });
}

/** Prämie (+) oder Abzug (−) mit Pflicht-Begründung; Korrektur = Gegenbuchung */
export async function addAdjustment(raw: { memberId: string; amount: string; negative: boolean; reason: string; date: string }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    assertWritable(ctx);
    const input = z
      .object({ memberId: uuid, amount: moneyInput, negative: z.boolean(), reason: z.string().trim().min(3).max(300), date: isoDate })
      .parse(raw);
    if (!input.amount || !input.date) throw new ActionError("invalid");
    must(await ctx.supabase.from("members").select("id").eq("id", input.memberId).eq("firm_id", ctx.firm.id).maybeSingle());
    check(
      await ctx.supabase.from("adjustments").insert({
        firm_id: ctx.firm.id,
        member_id: input.memberId,
        amount_cents: input.negative ? -input.amount : input.amount,
        reason: input.reason,
        effective_date: input.date,
        created_by: ctx.member.id,
      }),
    );
    refresh();
  });
}

/** Zeitkorrektur durch den Chef – Begründung Pflicht, alt/neu wird in time_edits protokolliert */
export async function editTimeRecord(raw: { kind: "shift" | "time_entry"; id: string; startedAt: string; endedAt: string | null; breakMinutes: number; reason: string }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const input = z
      .object({
        kind: z.enum(["shift", "time_entry"]),
        id: uuid,
        startedAt: z.string().datetime({ offset: true }),
        endedAt: z.string().datetime({ offset: true }).nullable(),
        breakMinutes: z.number().int().min(0).max(24 * 60),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(raw);
    const { error } = await ctx.supabase.rpc("edit_time_record", {
      p_kind: input.kind,
      p_id: input.id,
      p_started_at: input.startedAt,
      p_ended_at: input.endedAt,
      p_break_minutes: input.breakMinutes,
      p_reason: input.reason,
    });
    if (error) throw error;
    refresh();
  });
}

/** "Automatisch zuweisen": wenigste offene Aufgaben am Tag, ohne Urlaub/Krank, optional in Gruppe */
export async function suggestAssignee(raw: { date: string | null; groupId?: string | null }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const input = z.object({ date: isoDate, groupId: optUuid }).parse(raw);
    const [{ data: members }, { data: open }] = await Promise.all([
      ctx.supabase.from("members").select("*").eq("firm_id", ctx.firm.id),
      input.date
        ? ctx.supabase.from("tasks").select("assignee_id").eq("firm_id", ctx.firm.id).eq("due_date", input.date).neq("status", "done")
        : ctx.supabase.from("tasks").select("assignee_id").eq("firm_id", ctx.firm.id).neq("status", "done"),
    ]);
    const counts = new Map<string, number>();
    for (const t of open ?? []) if (t.assignee_id) counts.set(t.assignee_id, (counts.get(t.assignee_id) ?? 0) + 1);
    return { memberId: pickAssignee(members ?? [], counts, { groupId: input.groupId }) };
  });
}
