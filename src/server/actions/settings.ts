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
