"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireSuperadmin } from "@/lib/superadmin";
import { runAction } from "@/lib/action";
import { FEATURES } from "@/lib/features";
import { uuid } from "@/lib/validation";
import { parseMoneyToCents } from "@/lib/money";
import { LANDING_DEFAULTS } from "@/landing/content";

const done = () => revalidatePath("/admin", "layout");

/** Testzeitraum verlängern (+N Tage ab heute bzw. ab bisherigem Ende) */
export async function extendTrial(firmId: string, days = 14) {
  return runAction(async () => {
    const { email, admin } = await requireSuperadmin();
    const id = uuid.parse(firmId);
    const n = z.number().int().min(1).max(365).parse(days);
    const { data: f } = await admin.from("firms").select("trial_ends_at, plan").eq("id", id).single();
    const base = Math.max(Date.now(), new Date(f!.trial_ends_at).getTime());
    const next = new Date(base + n * 864e5).toISOString();
    await admin.from("firms").update({ trial_ends_at: next, plan: f!.plan === "expired" ? "trial" : f!.plan }).eq("id", id);
    await audit(admin, email, "trial_extend", id, { days: n, until: next });
    done();
  });
}

export async function setFirmPlan(firmId: string, plan: string) {
  return runAction(async () => {
    const { email, admin } = await requireSuperadmin();
    const id = uuid.parse(firmId);
    const p = z.enum(["trial", "paid", "expired", "blocked"]).parse(plan);
    await admin.from("firms").update({ plan: p }).eq("id", id);
    await audit(admin, email, "plan_set", id, { plan: p });
    done();
  });
}

export async function setGlobalFlag(key: string, enabled: boolean) {
  return runAction(async () => {
    const { email, admin } = await requireSuperadmin();
    const k = z.enum(FEATURES).parse(key);
    await admin.from("feature_flags").update({ default_enabled: z.boolean().parse(enabled), updated_at: new Date().toISOString() }).eq("key", k);
    await audit(admin, email, "flag_global", k, { enabled });
    done();
  });
}

/** Firmen-Überschreibung: true/false (vom Admin gesperrt) oder null = zurück auf Standard */
export async function setFirmFlag(firmId: string, key: string, enabled: boolean | null) {
  return runAction(async () => {
    const { email, admin } = await requireSuperadmin();
    const id = uuid.parse(firmId);
    const k = z.enum(FEATURES).parse(key);
    await admin.from("firm_features").delete().eq("firm_id", id).eq("key", k);
    if (enabled !== null) await admin.from("firm_features").insert({ firm_id: id, key: k, enabled: z.boolean().parse(enabled), set_by: "admin" });
    await audit(admin, email, "flag_firm", id, { key: k, enabled });
    done();
  });
}

export async function savePlanPrice(planId: string, price: string) {
  return runAction(async () => {
    const { email, admin } = await requireSuperadmin();
    const id = z.enum(["start", "pro"]).parse(planId);
    const cents = parseMoneyToCents(price);
    if (cents !== null && Number.isNaN(cents)) throw new z.ZodError([]);
    await admin.from("plans").update({ price_cents: cents, updated_at: new Date().toISOString() }).eq("id", id);
    await audit(admin, email, "plan_price", id, { cents });
    done();
  });
}

/** Landingpage-Texte als JSON (nur bekannte Schlüssel werden übernommen, siehe mergeLanding) */
export async function saveLandingContent(locale: string, json: string) {
  return runAction(async () => {
    const { email, admin } = await requireSuperadmin();
    const l = z.enum(["de", "ru"]).parse(locale);
    const parsed = JSON.parse(z.string().max(50_000).parse(json)) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new z.ZodError([]);
    const known = Object.keys(LANDING_DEFAULTS.de);
    const data = Object.fromEntries(Object.entries(parsed).filter(([k]) => known.includes(k)));
    await admin.from("site_content").delete().eq("key", "landing").eq("locale", l);
    await admin.from("site_content").insert({ key: "landing", locale: l, data });
    await audit(admin, email, "landing_save", l, { keys: Object.keys(data) });
    done();
    revalidatePath("/");
  });
}

export async function moderateReview(reviewId: string, status: "approved" | "rejected") {
  return runAction(async () => {
    const { email, admin } = await requireSuperadmin();
    const id = uuid.parse(reviewId);
    await admin.from("reviews").update({ moderation: z.enum(["approved", "rejected"]).parse(status) }).eq("id", id);
    await audit(admin, email, "review_moderate", id, { status });
    done();
    revalidatePath("/");
  });
}
