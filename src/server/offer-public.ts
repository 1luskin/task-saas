import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/** Angebot über den geheimen Link (service_role, nur dieses eine Angebot; Entwürfe nie) */
export async function loadPublicOffer(token: string) {
  if (!/^[0-9a-f]{20,128}$/i.test(token)) return null;
  const admin = createAdminClient();
  const { data: off } = await admin.from("offers").select("*").eq("token", token).maybeSingle();
  if (!off || off.status === "draft") return null;
  const [{ data: items }, { data: firm }] = await Promise.all([
    admin.from("offer_items").select("*").eq("offer_id", off.id).order("position"),
    admin.from("firms").select("*").eq("id", off.firm_id).single(),
  ]);
  if (!firm) return null;
  return { off, items: items ?? [], firm };
}
