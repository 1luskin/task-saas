"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBoss } from "@/lib/auth";
import { check, runAction } from "@/lib/action";
import { uuid } from "@/lib/validation";

export async function setTaskLocation(taskId: string, lat: number, lng: number) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(
      await ctx.supabase
        .from("tasks")
        .update({ lat: z.number().min(-90).max(90).parse(lat), lng: z.number().min(-180).max(180).parse(lng) })
        .eq("id", uuid.parse(taskId))
        .eq("firm_id", ctx.firm.id),
    );
    revalidatePath("/boss", "layout");
    revalidatePath("/staff", "layout");
  });
}

/** Geozone (Radius in m, null = aus) und Aufbewahrungsfrist der Standortpunkte */
export async function setGeoSettings(raw: { radius: number | null; retentionDays: number }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const input = z.object({ radius: z.number().int().min(50).max(5000).nullable(), retentionDays: z.number().int().min(7).max(365) }).parse(raw);
    check(await ctx.supabase.from("firms").update({ geofence_radius_m: input.radius, geo_retention_days: input.retentionDays }).eq("id", ctx.firm.id));
    revalidatePath("/boss/settings");
  });
}
