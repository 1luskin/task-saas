"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertBoss } from "@/lib/auth";
import { getPaymentProvider } from "@/lib/payments";
import { serverEnv } from "@/lib/env";

export async function startCheckout(plan: string) {
  const ctx = await assertBoss();
  const p = z.enum(["start", "pro"]).parse(plan);
  const { count } = await ctx.supabase.from("members").select("id", { count: "exact", head: true }).eq("firm_id", ctx.firm.id).is("archived_at", null);
  const res = await getPaymentProvider().createCheckout({
    firmId: ctx.firm.id,
    plan: p,
    employees: count ?? 1,
    returnUrl: `${serverEnv().NEXT_PUBLIC_APP_URL}/boss/plans`,
  });
  if (res.status === "redirect" && res.url) redirect(res.url);
  redirect(`/boss/plans/checkout?plan=${p}`);
}
