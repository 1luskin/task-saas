import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { layout, sendEmail } from "@/lib/email";
import { createT, dictionaries } from "@/i18n/config";
import { serverEnv } from "@/lib/env";
import { isoWeekday, todayISO, addDays, berlinStartOfDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { trialInfo } from "@/lib/trial";

const appUrl = () => serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

/** Tägliche E-Mails: Testzeitraum endet in ≤ 3 Tagen (einmal), Wochenbericht montags */
export async function runEmailJobs(now = Date.now()) {
  const admin = createAdminClient();
  const today = todayISO();
  const { data: firms } = await admin.from("firms").select("*").eq("is_demo", false);
  let trial = 0, weekly = 0;
  for (const f of firms ?? []) {
    const { data: boss } = await admin.from("members").select("email, locale, full_name").eq("firm_id", f.id).eq("role", "boss").is("archived_at", null).order("created_at").limit(1).maybeSingle();
    const to = f.contact_email ?? boss?.email;
    if (!to) continue;
    const t = createT(dictionaries[boss?.locale ?? "de"]);
    const info = trialInfo(f, now);
    if (f.plan === "trial" && !info.expired && info.daysLeft <= 3 && !f.trial_mail_sent_at) {
      const m = layout({ title: t("mail.trialTitle", { n: info.daysLeft }), lines: [t("mail.trialText")], cta: { label: t("trial.plans"), url: `${appUrl()}/boss/plans` }, footer: f.name });
      await sendEmail({ to, subject: t("mail.trialTitle", { n: info.daysLeft }), ...m });
      await admin.from("firms").update({ trial_mail_sent_at: new Date(now).toISOString() }).eq("id", f.id);
      trial++;
    }
    if (isoWeekday(today) === 1 && f.weekly_mail_last !== today) {
      const from = berlinStartOfDay(addDays(today, -7)).toISOString();
      const to2 = berlinStartOfDay(today).toISOString();
      const [{ count: done }, { data: fin }, { count: overdue }] = await Promise.all([
        admin.from("tasks").select("id", { count: "exact", head: true }).eq("firm_id", f.id).eq("status", "done").gte("accepted_at", from).lt("accepted_at", to2),
        admin.from("tasks").select("id").eq("firm_id", f.id).eq("status", "done").gte("accepted_at", from).lt("accepted_at", to2),
        admin.from("tasks").select("id", { count: "exact", head: true }).eq("firm_id", f.id).neq("status", "done").lt("due_date", today),
      ]);
      const ids = (fin ?? []).map((x) => x.id);
      const { data: prices } = ids.length ? await admin.from("task_finance").select("client_price_cents").in("task_id", ids) : { data: [] };
      const revenue = (prices ?? []).reduce((s, p) => s + p.client_price_cents, 0);
      const m = layout({
        title: t("mail.weeklyTitle"),
        lines: [t("mail.weeklyDone", { n: done ?? 0 }), t("mail.weeklyRevenue", { amount: formatMoney(revenue, boss?.locale ?? "de") }), t("mail.weeklyOverdue", { n: overdue ?? 0 })],
        cta: { label: t("mail.open"), url: `${appUrl()}/boss` },
        footer: f.name,
      });
      await sendEmail({ to, subject: t("mail.weeklyTitle"), ...m });
      await admin.from("firms").update({ weekly_mail_last: today }).eq("id", f.id);
      weekly++;
    }
  }
  return { trial, weekly };
}
