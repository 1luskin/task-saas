"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { assertBoss, assertMember, assertWritable, requireRecentAuth } from "@/lib/auth";
import { ActionError, check, must, runAction } from "@/lib/action";
import { locale, memberStatus, moneyInput, optText, optUuid, payMode, uuid } from "@/lib/validation";
import { LOCALE_COOKIE } from "@/i18n/config";
import type { Member } from "@/lib/supabase/types";

export async function createInvite(raw: { role: "boss" | "employee"; group_id?: string | null }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    assertWritable(ctx);
    const input = z.object({ role: z.enum(["boss", "employee"]), group_id: optUuid }).parse(raw);
    const inv = must(
      await ctx.supabase
        .from("invites")
        .insert({ firm_id: ctx.firm.id, role: input.role, group_id: input.group_id, created_by: ctx.member.id })
        .select("token")
        .single(),
    );
    revalidatePath("/boss/employees");
    return { token: inv.token };
  });
}

export async function revokeInvite(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("invites").update({ revoked: true }).eq("id", uuid.parse(id)));
    revalidatePath("/boss/employees");
  });
}

const memberUpdate = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: optText(40),
  role: z.enum(["boss", "employee"]),
  group_id: optUuid,
  status: memberStatus,
  pay_mode: payMode,
  hourly_rate: moneyInput,
  hourly_basis: z.enum(["tasks", "shifts"]).default("tasks"),
});

export async function updateMember(id: string, raw: z.input<typeof memberUpdate>) {
  return runAction(async () => {
    const ctx = await assertBoss();
    uuid.parse(id);
    const input = memberUpdate.parse(raw);
    // Rollenwechsel ist eine gefährliche Aktion → frische Code-Bestätigung nötig
    const current = must(await ctx.supabase.from("members").select("role").eq("id", id).eq("firm_id", ctx.firm.id).maybeSingle());
    if (current.role !== input.role) await requireRecentAuth(ctx);
    if (input.role !== "boss") {
      const { count } = await ctx.supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("firm_id", ctx.firm.id)
        .eq("role", "boss")
        .is("archived_at", null)
        .neq("id", id);
      if (!count) throw new ActionError("invalid", "last_boss");
    }
    check(
      await ctx.supabase
        .from("members")
        .update({
          full_name: input.full_name,
          phone: input.phone,
          role: input.role,
          group_id: input.group_id,
          status: input.status,
          pay_mode: input.pay_mode,
          hourly_rate_cents: input.hourly_rate ?? 0,
          hourly_basis: input.hourly_basis,
        })
        .eq("id", id),
    );
    revalidatePath("/boss", "layout");
  });
}

/** Mitarbeiter "entfernen": archivieren (Verlauf/Verdienst bleibt), offene Aufgaben freigeben. */
export async function removeMember(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    uuid.parse(id);
    if (id === ctx.member.id) throw new ActionError("invalid", "last_boss");
    check(
      await ctx.supabase
        .from("tasks")
        .update({ assignee_id: null })
        .eq("assignee_id", id)
        .neq("status", "done"),
    );
    check(await ctx.supabase.from("members").update({ archived_at: new Date().toISOString(), user_id: null }).eq("id", id));
    revalidatePath("/boss", "layout");
  });
}

export async function createGroup(name: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    assertWritable(ctx);
    const n = z.string().trim().min(1).max(80).parse(name);
    check(await ctx.supabase.from("groups").insert({ firm_id: ctx.firm.id, name: n }));
    revalidatePath("/boss", "layout");
  });
}

export async function deleteGroup(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("groups").delete().eq("id", uuid.parse(id)));
    revalidatePath("/boss", "layout");
  });
}

const profileUpdate = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  phone: optText(40).optional(),
  status: memberStatus.optional(),
  locale: locale.optional(),
  notify_overdue: z.boolean().optional(),
  notify_done: z.boolean().optional(),
});

/** Eigenes Profil (Name, Urlaub/Krank, Sprache, Benachrichtigungen). */
export async function updateMyProfile(raw: z.input<typeof profileUpdate>) {
  return runAction(async () => {
    const ctx = await assertMember();
    const input = profileUpdate.parse(raw);
    const patch: Partial<Member> = {};
    if (input.full_name !== undefined) patch.full_name = input.full_name;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.status !== undefined) patch.status = input.status;
    if (input.locale !== undefined) patch.locale = input.locale;
    if (input.notify_overdue !== undefined) patch.notify_overdue = input.notify_overdue;
    if (input.notify_done !== undefined) patch.notify_done = input.notify_done;
    if (Object.keys(patch).length) {
      check(await ctx.supabase.from("members").update(patch).eq("id", ctx.member.id));
    }
    if (input.locale) {
      (await cookies()).set(LOCALE_COOKIE, input.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    revalidatePath("/", "layout");
  });
}

export async function updateFirm(raw: { name: string }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const name = z.string().trim().min(1).max(120).parse(raw.name);
    check(await ctx.supabase.from("firms").update({ name }).eq("id", ctx.firm.id));
    revalidatePath("/", "layout");
  });
}
