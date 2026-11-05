"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertBoss, assertMember } from "@/lib/auth";
import { ActionError, check, runAction } from "@/lib/action";
import { FEATURES, loadFeatures } from "@/lib/features";
import { createAdminClient } from "@/lib/supabase/server";
import { isDemo } from "@/lib/demo/mode";
import { clientIpHash } from "@/lib/rate-limit";
import { NOTIFY_TYPES } from "@/lib/notify-types";

const fieldsSchema = z.object({
  description: z.boolean(), address: z.boolean(), due_time: z.boolean(), checklist: z.boolean(),
  client_price: z.boolean(), fixed_pay: z.boolean(), photos: z.boolean(),
});

/** Welche Felder das Aufgabenformular zeigt */
export async function setTaskFields(raw: z.input<typeof fieldsSchema>) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("firms").update({ task_fields: fieldsSchema.parse(raw) }).eq("id", ctx.firm.id));
    revalidatePath("/boss", "layout");
  });
}

/** Funktion für die eigene Firma an/aus (nicht, wenn vom Superadmin gesperrt) */
export async function setMyFirmFeature(key: string, enabled: boolean) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const k = z.enum(FEATURES).parse(key);
    const cur = (await loadFeatures(ctx)).get(k);
    if (cur?.locked) throw new ActionError("forbidden", "locked");
    await ctx.supabase.from("firm_features").delete().eq("firm_id", ctx.firm.id).eq("key", k).eq("set_by", "boss");
    check(await ctx.supabase.from("firm_features").insert({ firm_id: ctx.firm.id, key: k, enabled: z.boolean().parse(enabled), set_by: "boss" }));
    revalidatePath("/boss", "layout");
  });
}

export async function setShiftAutoclose(hours: number) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("firms").update({ shift_autoclose_hours: z.number().int().min(4).max(24).parse(hours) }).eq("id", ctx.firm.id));
    revalidatePath("/boss/settings");
  });
}

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Logo hochladen: Typ und Größe werden auf dem Server geprüft (max. 512 KB) */
export async function uploadLogo(form: FormData) {
  return runAction(async () => {
    const ctx = await assertBoss();
    if (isDemo()) throw new ActionError("invalid", "demo");
    const file = form.get("logo");
    if (!(file instanceof File)) throw new ActionError("invalid");
    const ext = LOGO_TYPES[file.type];
    if (!ext || file.size > 512 * 1024 || file.size === 0) throw new ActionError("invalid", "logo_type_size");
    const path = `${ctx.firm.id}/logo-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await ctx.supabase.storage.from("firm-logos").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    if (ctx.firm.logo_path) await ctx.supabase.storage.from("firm-logos").remove([ctx.firm.logo_path]);
    check(await ctx.supabase.from("firms").update({ logo_path: path }).eq("id", ctx.firm.id));
    revalidatePath("/", "layout");
  });
}

export async function removeLogo() {
  return runAction(async () => {
    const ctx = await assertBoss();
    if (ctx.firm.logo_path) await ctx.supabase.storage.from("firm-logos").remove([ctx.firm.logo_path]);
    check(await ctx.supabase.from("firms").update({ logo_path: null }).eq("id", ctx.firm.id));
    revalidatePath("/", "layout");
  });
}

/** Auf allen Geräten abmelden (Supabase: alle Refresh-Tokens widerrufen) */
export async function logoutAllDevices() {
  const ctx = await assertMember();
  if (!isDemo()) {
    await createAdminClient().from("login_events").insert({ user_id: ctx.userId, kind: "logout_all", ip_hash: await clientIpHash() });
    await ctx.supabase.auth.signOut({ scope: "global" });
  }
  redirect("/login");
}

/** Benachrichtigung je Typ an/aus (eigene Einstellung) */
export async function setNotifyPref(type: string, enabled: boolean) {
  return runAction(async () => {
    const ctx = await assertMember();
    const allowed: readonly string[] = ctx.member.role === "boss" ? NOTIFY_TYPES.boss : NOTIFY_TYPES.employee;
    const tp = z.string().parse(type);
    if (!allowed.includes(tp)) throw new ActionError("invalid");
    await ctx.supabase.from("notification_prefs").delete().eq("member_id", ctx.member.id).eq("type", tp);
    check(await ctx.supabase.from("notification_prefs").insert({ member_id: ctx.member.id, type: tp, enabled: z.boolean().parse(enabled) }));
  });
}

const accountNo = z.number().int().min(1).max(99999999).nullable().optional();
const accountingSchema = z.object({
  consultantNo: z.number().int().min(1001).max(9999999).nullable(),
  clientNo: z.number().int().min(1).max(99999).nullable(),
  skr: z.enum(["03", "04"]),
  vatRate: z.union([z.literal(0), z.literal(7), z.literal(19)]),
  smallBusiness: z.boolean(),
  accounts: z.object({ debitor: accountNo, cash: accountNo, expense: accountNo, material: accountNo }),
});
/** Buchhaltung: DATEV-Stammdaten, USt-Satz, Kleinunternehmer */
export async function saveAccounting(raw: z.input<typeof accountingSchema>) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const i = accountingSchema.parse(raw);
    const accounts = Object.fromEntries(Object.entries(i.accounts).filter(([, v]) => typeof v === "number"));
    check(await ctx.supabase.from("firms").update({
      datev_consultant_no: i.consultantNo, datev_client_no: i.clientNo, datev_skr: i.skr, datev_accounts: accounts,
      vat_rate: i.smallBusiness ? 0 : i.vatRate, small_business: i.smallBusiness,
    }).eq("id", ctx.firm.id));
    revalidatePath("/boss/settings");
    revalidatePath("/boss/money");
  });
}
