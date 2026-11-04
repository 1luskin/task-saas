"use server";

import { z } from "zod";
import { assertMember } from "@/lib/auth";
import { runAction } from "@/lib/action";

export async function dismissHint(key: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    await ctx.supabase.rpc("dismiss_hint", { p_key: z.string().regex(/^[a-z0-9_-]{1,40}$/).parse(key) });
  });
}

export async function finishOnboarding() {
  return runAction(async () => {
    const ctx = await assertMember();
    await ctx.supabase.rpc("finish_onboarding");
  });
}
