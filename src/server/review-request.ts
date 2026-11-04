import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail, layout } from "@/lib/email";
import { createT, dictionaries } from "@/i18n/config";
import { serverEnv } from "@/lib/env";

/**
 * Nach Abnahme: Kunde (mit E-Mail) um Bewertung bitten – mit Kunden-Link.
 * Nicht für Demo-Firmen, nicht doppelt (bestehende Bewertung).
 */
export async function requestReview(taskId: string) {
  const admin = createAdminClient();
  const { data: task } = await admin.from("tasks").select("id, title, firm_id, client_id").eq("id", taskId).maybeSingle();
  if (!task?.client_id) return;
  const [{ data: client }, { data: firm }, { data: review }] = await Promise.all([
    admin.from("clients").select("email").eq("id", task.client_id).maybeSingle(),
    admin.from("firms").select("name, is_demo").eq("id", task.firm_id).single(),
    admin.from("reviews").select("id").eq("task_id", task.id).limit(1),
  ]);
  if (!client?.email || firm?.is_demo || review?.length) return;
  let { data: link } = await admin.from("task_links").select("token, expires_at").eq("task_id", task.id).eq("revoked", false).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!link || new Date(link.expires_at).getTime() < Date.now()) {
    const ins = await admin.from("task_links").insert({ task_id: task.id, firm_id: task.firm_id }).select("token, expires_at").single();
    link = ins.data;
  }
  if (!link) return;
  const t = createT(dictionaries.de);
  const url = `${serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/c/${link.token}`;
  const m = layout({ title: t("cl.reviewMailSubject", { title: task.title }), lines: [t("cl.reviewMailText")], cta: { label: t("cl.reviewMailCta"), url }, footer: firm?.name ?? "" });
  await sendEmail({ to: client.email, subject: t("cl.reviewMailSubject", { title: task.title }), ...m });
}
