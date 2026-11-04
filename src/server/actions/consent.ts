"use server";

import { z } from "zod";
import { getContext } from "@/lib/auth";
import { LEGAL_VERSION } from "@/legal/content";
import { createClient } from "@/lib/supabase/server";

/** Einwilligung mit Datum + Textversion speichern (nur für angemeldete Nutzer; Gäste: Gerät) */
export async function recordConsent(kind: "cookies" | "geolocation" | "review_publish" | "terms", granted: boolean) {
  const k = z.enum(["cookies", "geolocation", "review_publish", "terms"]).parse(kind);
  const ctx = await getContext();
  if (!ctx) return { ok: true as const };
  const supabase = await createClient();
  await supabase.from("consents").insert({
    user_id: ctx.userId,
    member_id: ctx.member?.id ?? null,
    kind: k,
    version: LEGAL_VERSION,
    granted: z.boolean().parse(granted),
  });
  return { ok: true as const };
}
