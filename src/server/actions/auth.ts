"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runAction } from "@/lib/action";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { DEMO_COOKIE, isDemo } from "@/lib/demo/mode";

export async function createFirm(raw: { firmName: string; fullName: string }) {
  const res = await runAction(async () => {
    const input = z
      .object({ firmName: z.string().trim().min(1).max(120), fullName: z.string().trim().min(1).max(120) })
      .parse(raw);
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_firm", {
      p_firm_name: input.firmName,
      p_full_name: input.fullName,
      p_locale: await getLocale(),
    });
    if (error) throw error;
  });
  if (res.ok) redirect("/boss");
  return res;
}

export async function acceptInvite(raw: { token: string; fullName: string }) {
  const res = await runAction(async () => {
    const input = z
      .object({ token: z.string().regex(/^[0-9a-f]{20,64}$/), fullName: z.string().trim().min(1).max(120) })
      .parse(raw);
    const supabase = await createClient();
    const { error } = await supabase.rpc("accept_invite", {
      p_token: input.token,
      p_full_name: input.fullName,
      p_locale: await getLocale(),
    });
    if (error) throw error;
  });
  if (res.ok) redirect("/");
  return res;
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  if (isDemo()) (await cookies()).delete(DEMO_COOKIE);
  redirect("/login");
}

/** Sprache ohne Login (Login-Seite) */
export async function setLocaleCookie(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
