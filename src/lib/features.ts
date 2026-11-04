import "server-only";
import { cache } from "react";
import type { Ctx } from "./auth";
import { ActionError } from "./action";

/** Bekannte Feature-Flags (DB: feature_flags). Neue Flags: hier + Migration. */
export const FEATURES = [
  "templates", "requests", "reports", "excel_export", "custom_statuses", "demo_firm",
  "kanban", "clients", "expenses", "shifts", "geolocation", "invoices", "public_form",
] as const;
export type FeatureKey = (typeof FEATURES)[number];

export interface FeatureState {
  key: FeatureKey;
  enabled: boolean;
  /** vom Superadmin für diese Firma erzwungen → Chef kann es nicht ändern */
  locked: boolean;
  defaultEnabled: boolean;
}

/** Wirksame Flags der Firma (global → Firmen-Überschreibung), pro Request gecacht */
export const loadFeatures = cache(async (ctx: Ctx): Promise<Map<FeatureKey, FeatureState>> => {
  const [{ data: flags }, { data: overrides }] = await Promise.all([
    ctx.supabase.from("feature_flags").select("*"),
    ctx.supabase.from("firm_features").select("*").eq("firm_id", ctx.firm.id),
  ]);
  const map = new Map<FeatureKey, FeatureState>();
  for (const k of FEATURES) {
    const f = flags?.find((x) => x.key === k);
    const o = overrides?.find((x) => x.key === k);
    const def = f?.default_enabled ?? true;
    map.set(k, { key: k, defaultEnabled: def, enabled: o ? o.enabled : def, locked: o?.set_by === "admin" });
  }
  return map;
});

export async function isEnabled(ctx: Ctx, key: FeatureKey): Promise<boolean> {
  return (await loadFeatures(ctx)).get(key)?.enabled ?? true;
}

/** Server lehnt ausgeschaltete Funktionen ab (nicht nur ausgeblendet) */
export async function assertFeature(ctx: Ctx, key: FeatureKey) {
  if (!(await isEnabled(ctx, key))) throw new ActionError("forbidden", "feature_disabled");
}
