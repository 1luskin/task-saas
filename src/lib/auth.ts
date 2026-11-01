import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Firm, Member } from "@/lib/supabase/types";

export interface Ctx {
  userId: string;
  email: string | null;
  member: Member;
  firm: Firm;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/** Aktueller Nutzer + Mitgliedschaft (pro Request gecacht). */
export const getContext = cache(async (): Promise<Ctx | { userId: string; email: string | null; member: null } | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", auth.user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!member) return { userId: auth.user.id, email: auth.user.email ?? null, member: null };
  const { data: firm } = await supabase.from("firms").select("*").eq("id", member.firm_id).single();
  if (!firm) return { userId: auth.user.id, email: auth.user.email ?? null, member: null };
  return { userId: auth.user.id, email: auth.user.email ?? null, member, firm, supabase };
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
  constructor(public code: "unauthenticated" | "forbidden") {
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
