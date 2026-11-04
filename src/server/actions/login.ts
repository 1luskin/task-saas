"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { clientIpHash, hit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { isDemo } from "@/lib/demo/mode";

export type LoginResult = { ok: true } | { ok: false; error: "invalid" | "rate_limited" | "captcha" | "wrong_code" | "error" };

const emailSchema = z.string().trim().toLowerCase().email().max(254);

/**
 * Schritt 1: Einmal-Code per E-Mail anfordern – serverseitig mit Rate-Limit
 * (5/h pro E-Mail, 20/h pro IP) und optional Turnstile.
 * Antwort verrät nicht, ob die E-Mail existiert.
 */
export async function requestCode(raw: { email: string; captcha?: string | null }): Promise<LoginResult> {
  if (isDemo()) return { ok: false, error: "error" };
  const parsed = emailSchema.safeParse(raw.email);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const email = parsed.data;
  const ip = await clientIpHash();
  if (!(await hit("otpIp", ip)) || !(await hit("otpEmail", email))) return { ok: false, error: "rate_limited" };
  if (!(await verifyTurnstile(raw.captcha))) return { ok: false, error: "captcha" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    // z. B. Supabase-eigene Limits; keine Details nach außen
    console.error("[otp] request failed:", error.status, error.code);
    return { ok: false, error: error.status === 429 ? "rate_limited" : "error" };
  }
  return { ok: true };
}

/**
 * Schritt 2: Code prüfen – max. 5 Versuche pro 15 min und E-Mail, danach Pause.
 * Setzt die Session-Cookies (Server-Client) und protokolliert den Login.
 */
export async function verifyCode(raw: { email: string; code: string; reauth?: boolean }): Promise<LoginResult> {
  if (isDemo()) return { ok: false, error: "error" };
  const email = emailSchema.safeParse(raw.email);
  const code = z.string().regex(/^\d{6,10}$/).safeParse(raw.code.replace(/\s/g, ""));
  if (!email.success || !code.success) return { ok: false, error: "invalid" };
  if (!(await hit("otpVerify", email.data))) return { ok: false, error: "rate_limited" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email: email.data, token: code.data, type: "email" });
  if (error || !data.user) return { ok: false, error: "wrong_code" };

  const h = await headers();
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await Promise.all([
    admin.from("login_events").insert({
      user_id: data.user.id,
      kind: raw.reauth ? "reauth" : "login",
      user_agent: (h.get("user-agent") ?? "").slice(0, 200),
      ip_hash: await clientIpHash(),
    }),
    admin.from("user_settings").upsert({ user_id: data.user.id, reauth_at: now }, { onConflict: "user_id" }),
  ]);
  return { ok: true };
}
