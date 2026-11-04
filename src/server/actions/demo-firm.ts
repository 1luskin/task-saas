"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getContext } from "@/lib/auth";
import { DEMO_COOKIE, isDemo } from "@/lib/demo/mode";
import { demoDb, resetDemoDb } from "@/lib/demo/fake-client";
import { DEMO } from "@/lib/demo/seed";

async function demoLoginCookie(uid: string) {
  (await cookies()).set(DEMO_COOKIE, uid, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 });
}

/** Demo-Firma anlegen (falls nötig) und hineinwechseln */
export async function openDemoFirm() {
  if (isDemo()) redirect("/boss");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_demo_firm");
  if (error) throw error;
  await supabase.rpc("switch_firm", { p_target: "demo" });
  redirect("/boss");
}

export async function switchToOwnFirm() {
  if (isDemo()) redirect("/boss");
  const supabase = await createClient();
  await supabase.rpc("switch_firm", { p_target: "own" });
  redirect("/boss");
}

/** "Ansehen als": null = Inhaber, sonst Demo-Mitarbeiter (DB erlaubt das nur in Demo-Firmen) */
export async function actAs(memberId: string | null) {
  const id = z.string().uuid().nullable().parse(memberId);
  if (isDemo()) {
    // Demo-Modus ohne Supabase: Rollenwechsel = Anmeldung als andere Testperson
    const m = id ? demoDb().members.find((x) => x.id === id && x.role === "employee") : null;
    await demoLoginCookie(m?.user_id ?? DEMO.bossUser);
    redirect(m ? "/staff/today" : "/boss");
  }
  const ctx = await getContext();
  if (!ctx || !ctx.member) redirect("/login");
  const { error } = await ctx.supabase.rpc("set_acting", { p_member: id });
  if (error) throw error;
  redirect(id ? "/staff/today" : "/boss");
}

export async function resetDemoFirm() {
  if (isDemo()) {
    resetDemoDb();
    await demoLoginCookie(DEMO.bossUser);
    redirect("/boss");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_demo_firm");
  if (error) throw error;
  redirect("/boss");
}
