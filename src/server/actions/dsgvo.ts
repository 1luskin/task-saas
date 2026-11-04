"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBoss, assertMember, requireRecentAuth } from "@/lib/auth";
import { check, runAction } from "@/lib/action";
import { uuid } from "@/lib/validation";

/** Vor dem Komplett-Export prüfen, ob eine frische Code-Bestätigung nötig ist */
export async function checkExportAllowed() {
  return runAction(async () => {
    const ctx = await assertBoss();
    await requireRecentAuth(ctx, 15);
  });
}

/** Firma löschen: Name bestätigen + Code; endgültig nach 30 Tagen (Cron), bis dahin widerrufbar */
export async function requestFirmDeletion(confirmName: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    if (z.string().trim().parse(confirmName) !== ctx.firm.name.trim()) throw new Error("name mismatch");
    await requireRecentAuth(ctx);
    const now = new Date();
    check(
      await ctx.supabase
        .from("firms")
        .update({ deletion_requested_at: now.toISOString(), deletion_scheduled_for: new Date(now.getTime() + 30 * 864e5).toISOString() })
        .eq("id", ctx.firm.id),
    );
    revalidatePath("/boss", "layout");
  });
}

export async function cancelFirmDeletion() {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("firms").update({ deletion_requested_at: null, deletion_scheduled_for: null }).eq("id", ctx.firm.id));
    revalidatePath("/boss", "layout");
  });
}

/** Mitarbeiter: Löschung der eigenen Daten beantragen */
export async function requestMyDeletion(note?: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    const { count } = await ctx.supabase.from("data_requests").select("id", { count: "exact", head: true }).eq("member_id", ctx.member.id).eq("status", "open");
    if ((count ?? 0) > 0) return;
    check(
      await ctx.supabase.from("data_requests").insert({
        firm_id: ctx.firm.id,
        member_id: ctx.member.id,
        kind: "delete",
        note: z.string().trim().max(1000).optional().parse(note) ?? null,
      }),
    );
    revalidatePath("/staff/profile");
  });
}

export async function resolveDataRequest(id: string, status: "done" | "rejected") {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(
      await ctx.supabase
        .from("data_requests")
        .update({ status: z.enum(["done", "rejected"]).parse(status), resolved_at: new Date().toISOString() })
        .eq("id", uuid.parse(id))
        .eq("firm_id", ctx.firm.id),
    );
    revalidatePath("/boss/settings");
  });
}
