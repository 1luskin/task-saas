"use server";

import { z } from "zod";
import { assertMember } from "@/lib/auth";

/** Globale Suche (RPC mit RLS: Mitarbeiter findet nur Eigenes) */
export async function searchAll(q: string) {
  const ctx = await assertMember();
  const query = z.string().trim().max(80).parse(q);
  if (query.length < 2) return [];
  const { data } = await ctx.supabase.rpc("search_all", { p_q: query, p_limit: 6 });
  const boss = ctx.member.role === "boss";
  return (data ?? []).map((r) => ({
    ...r,
    href:
      r.kind === "task" ? `/${boss ? "boss" : "staff"}/tasks/${r.id}`
      : r.kind === "member" ? (boss ? `/boss/employees/${r.id}/times` : "/staff/profile")
      : r.kind === "client" ? `/boss/clients/${r.id}`
      : boss ? "/boss/requests" : "/staff/profile",
  }));
}
