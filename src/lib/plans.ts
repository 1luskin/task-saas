import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PLANS, type Plan } from "@/lib/payments";

/** Tarife inkl. Preise aus der DB (Superadmin); Fallback: Platzhalter */
export async function getPlans(): Promise<Plan[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("plans").select("*").order("position");
    if (!data?.length) return DEFAULT_PLANS;
    return data.map((p) => ({ id: p.id, pricePerEmployeeCents: p.price_cents }));
  } catch {
    return DEFAULT_PLANS;
  }
}
