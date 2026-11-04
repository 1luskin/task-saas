"use server";

import { after } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { resolveLink } from "@/server/client-link";
import { clientIpHash, hit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { createAdminClient } from "@/lib/supabase/server";
import { notifyBosses } from "@/server/notify";
import { LEGAL_VERSION } from "@/legal/content";

type R = { ok: true } | { ok: false; error: "invalid" | "rate_limited" | "error" };

/** Kunde nimmt Arbeit über den Link ab (nur Status "Zur Prüfung") */
export async function clientAccept(token: string): Promise<R> {
  if (!(await hit("publicLink", await clientIpHash()))) return { ok: false, error: "rate_limited" };
  const r = await resolveLink(token);
  if (!r) return { ok: false, error: "invalid" };
  if (r.task.status === "done") return { ok: true };
  if (r.task.status !== "review") return { ok: false, error: "invalid" };
  const now = new Date().toISOString();
  const { error } = await r.admin
    .from("tasks")
    .update({ status: "done", accepted_at: now, completed_at: now, accepted_via: "client" })
    .eq("id", r.task.id)
    .eq("status", "review");
  if (error) return { ok: false, error: "error" };
  await r.admin.from("time_entries").update({ ended_at: now }).eq("task_id", r.task.id).is("ended_at", null);
  const title = r.task.title;
  after(() => notifyBosses(r.task.firm_id, (t) => ({ title: t("push.clientAccepted"), body: title, url: `/boss/tasks/${r.task.id}`, tag: `client-${r.task.id}` })));
  return { ok: true };
}

/** Bewertung 1–5 + Kommentar + Einwilligung zur Veröffentlichung (mit Version) */
export async function clientReview(token: string, raw: { rating: number; comment: string; allowPublish: boolean; name: string }): Promise<R> {
  if (!(await hit("publicLink", await clientIpHash()))) return { ok: false, error: "rate_limited" };
  const r = await resolveLink(token);
  if (!r) return { ok: false, error: "invalid" };
  const input = z
    .object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(2000), allowPublish: z.boolean(), name: z.string().trim().max(80) })
    .safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const { data: existing } = await r.admin.from("reviews").select("id").eq("task_id", r.task.id).limit(1);
  if (existing?.length) return { ok: true };
  const { error } = await r.admin.from("reviews").insert({
    firm_id: r.task.firm_id,
    task_id: r.task.id,
    rating: input.data.rating,
    comment: input.data.comment || null,
    client_name: input.data.name || null,
    allow_publish: input.data.allowPublish,
  });
  if (error) return { ok: false, error: "error" };
  if (input.data.allowPublish) {
    await r.admin.from("consents").insert({ kind: "review_publish", version: LEGAL_VERSION, granted: true, user_id: null, member_id: null });
  }
  after(() => notifyBosses(r.task.firm_id, (t) => ({ title: t("push.newReview"), body: `${input.data.rating}/5 · ${r.task.title}`, url: `/boss/clients`, tag: `review-${r.task.id}` })));
  return { ok: true };
}

// --- öffentliche Anfrage-Seite -------------------------------------------------

const secret = () => process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret";

/** Signierter Zeitstempel: Formular muss ≥ 3 s offen gewesen sein (Bots sind schneller) */
export async function formStamp(): Promise<string> {
  const ts = String(Date.now());
  return `${ts}.${createHmac("sha256", secret()).update(ts).digest("hex").slice(0, 32)}`;
}

function stampOk(stamp: string): boolean {
  const [ts, sig] = stamp.split(".");
  if (!ts || !sig) return false;
  const exp = createHmac("sha256", secret()).update(ts).digest("hex").slice(0, 32);
  if (exp.length !== sig.length || !timingSafeEqual(Buffer.from(exp), Buffer.from(sig))) return false;
  const age = Date.now() - Number(ts);
  return age >= 3000 && age <= 2 * 3600_000;
}

export async function submitInbound(slug: string, raw: { name: string; contact: string; address: string; message: string; website: string; stamp: string; captcha?: string | null }): Promise<R> {
  // Honeypot "website" muss leer sein; Bots bekommen ein stilles "ok"
  if (raw.website) return { ok: true };
  if (!stampOk(raw.stamp)) return { ok: false, error: "invalid" };
  if (!(await hit("publicForm", await clientIpHash()))) return { ok: false, error: "rate_limited" };
  if (!(await verifyTurnstile(raw.captcha))) return { ok: false, error: "invalid" };
  const input = z
    .object({
      name: z.string().trim().min(1).max(160),
      contact: z.string().trim().min(3).max(254),
      address: z.string().trim().max(300),
      message: z.string().trim().min(1).max(4000),
    })
    .safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const admin = createAdminClient();
  const { data: firm } = await admin.from("firms").select("id, plan, is_demo, trial_ends_at").eq("public_slug", z.string().regex(/^[a-z0-9-]{3,40}$/).parse(slug)).maybeSingle();
  if (!firm) return { ok: false, error: "invalid" };
  const [{ data: flag }, { data: ov }] = await Promise.all([
    admin.from("feature_flags").select("default_enabled").eq("key", "public_form").maybeSingle(),
    admin.from("firm_features").select("enabled").eq("firm_id", firm.id).eq("key", "public_form").maybeSingle(),
  ]);
  if (!(ov ? ov.enabled : flag?.default_enabled)) return { ok: false, error: "invalid" };
  const { error } = await admin.from("inbound_requests").insert({
    firm_id: firm.id,
    name: input.data.name,
    contact: input.data.contact,
    address: input.data.address || null,
    message: input.data.message,
  });
  if (error) return { ok: false, error: "error" };
  after(() => notifyBosses(firm.id, (t) => ({ title: t("push.newInbound"), body: input.data.message.slice(0, 120), url: "/boss/requests", tag: "inbound" })));
  return { ok: true };
}
