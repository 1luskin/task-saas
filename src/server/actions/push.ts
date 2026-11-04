"use server";

import { z } from "zod";
import { assertMember } from "@/lib/auth";
import { check, runAction } from "@/lib/action";
import { createAdminClient } from "@/lib/supabase/server";

const subInput = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(5).max(200) }),
});

export async function savePushSubscription(raw: z.input<typeof subInput>) {
  return runAction(async () => {
    const ctx = await assertMember();
    const sub = subInput.parse(raw);
    // Endpoint kann vorher einem anderen Konto auf demselben Gerät gehört haben
    await createAdminClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    check(
      await ctx.supabase.from("push_subscriptions").insert({
        user_id: ctx.userId,
        member_id: ctx.member.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      }),
    );
  });
}

export async function deletePushSubscription(endpoint: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    check(await ctx.supabase.from("push_subscriptions").delete().eq("endpoint", z.string().url().parse(endpoint)));
  });
}
