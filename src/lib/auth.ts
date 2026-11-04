import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canWrite } from "@/lib/trial";
import { isDemo } from "@/lib/demo/mode";
import type { Firm, Member, UserSettings } from "@/lib/supabase/types";

export interface Ctx {
  userId: string;
  email: string | null;
  /** wirksame Mitgliedschaft (bei "Ansehen als Mitarbeiter" der Demo-Mitarbeiter) */
  member: Member;
  firm: Firm;
  supabase: Awaited<ReturnType<typeof createClient>>;
  /** Chef der Demo-Firma sieht die App gerade als Mitarbeiter */
  acting: boolean;
  ownMemberId: string | null;
  demoMemberId: string | null;
  settings: Pick<UserSettings, "onboarding_done" | "hints_dismissed">;
}

/** Aktueller Nutzer + Mitgliedschaft (pro Request gecacht). */
export const getContext = cache(async (): Promise<Ctx | { userId: string; email: string | null; member: null } | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  // Wirksame Mitgliedschaft kommt aus der DB (eigene Firma / Demo-Firma / acting)
  const { data: cc } = await supabase.rpc("current_context");
  const c = cc?.[0];
  if (!c?.member_id) return { userId: auth.user.id, email: auth.user.email ?? null, member: null };
  const [{ data: member }, { data: us }] = await Promise.all([
    supabase.from("members").select("*").eq("id", c.member_id).maybeSingle(),
    supabase.from("user_settings").select("onboarding_done, hints_dismissed").eq("user_id", auth.user.id).maybeSingle(),
  ]);
  if (!member) return { userId: auth.user.id, email: auth.user.email ?? null, member: null };
  const { data: firm } = await supabase.from("firms").select("*").eq("id", member.firm_id).single();
  if (!firm) return { userId: auth.user.id, email: auth.user.email ?? null, member: null };
  return {
    userId: auth.user.id,
    email: auth.user.email ?? null,
    member,
    firm,
    supabase,
    acting: c.acting,
    ownMemberId: c.own_member_id,
    demoMemberId: c.demo_member_id,
    settings: { onboarding_done: us?.onboarding_done ?? false, hints_dismissed: us?.hints_dismissed ?? [] },
  };
});

/** Für Seiten: leitet um, falls nicht eingeloggt / kein Mitglied. */
export async function requireMember(): Promise<Ctx> {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  if (!ctx.member) redirect("/onboarding");
  return ctx as Ctx;
}

export async function requireBossPage(): Promise<Ctx> {
  const ctx = await requireMember();
  if (ctx.member.role !== "boss") redirect("/staff/today");
  return ctx;
}

export async function requireStaffPage(): Promise<Ctx> {
  const ctx = await requireMember();
  if (ctx.member.role === "boss") redirect("/boss");
  return ctx;
}

export class AuthError extends Error {
  constructor(public code: "unauthenticated" | "forbidden" | "expired" | "reauth") {
    super(code);
  }
}

/** Für Server Actions / Route Handler: wirft statt umzuleiten. */
export async function assertMember(): Promise<Ctx> {
  const ctx = await getContext();
  if (!ctx || !ctx.member) throw new AuthError("unauthenticated");
  return ctx as Ctx;
}

export async function assertBoss(): Promise<Ctx> {
  const ctx = await assertMember();
  if (ctx.member.role !== "boss") throw new AuthError("forbidden");
  return ctx;
}

/** Nach Ende des Testzeitraums: nichts Neues anlegen (DB prüft zusätzlich per RLS). */
export function assertWritable(ctx: Ctx) {
  if (!canWrite(ctx.firm)) throw new AuthError("expired");
}

/** Gefährliche Aktionen (Rollen ändern, Firma löschen, Komplett-Export): Code-Bestätigung ≤ 10 min alt */
export async function requireRecentAuth(ctx: Ctx, maxMinutes = 10) {
  if (isDemo()) return;
  const { data } = await ctx.supabase.from("user_settings").select("reauth_at").eq("user_id", ctx.userId).maybeSingle();
  const at = data?.reauth_at ? new Date(data.reauth_at).getTime() : 0;
  if (Date.now() - at > maxMinutes * 60_000) throw new AuthError("reauth");
}
