import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPushToMembers } from "@/lib/push";
import { autoAcceptDue, reviewReminderDue } from "@/lib/workflow";
import { notifyAccepted } from "@/server/notify";
import { requestReview } from "@/server/review-request";

/** Auto-Abnahme + Erinnerung an den Chef (läuft in /api/cron/frequent). */
export async function runReviewJobs(now = Date.now()) {
  const admin = createAdminClient();
  const { data: tasks } = await admin.from("tasks").select("*").eq("status", "review");
  const list = tasks ?? [];
  if (!list.length) return { accepted: 0, reminded: 0 };
  const firmIds = [...new Set(list.map((t) => t.firm_id))];
  const { data: firms } = await admin.from("firms").select("id, auto_accept_days").in("id", firmIds);
  const days = new Map((firms ?? []).map((f) => [f.id, f.auto_accept_days]));

  let accepted = 0;
  const remind = new Map<string, string[]>();
  const nowIso = new Date(now).toISOString();
  for (const t of list) {
    const d = days.get(t.firm_id) ?? null;
    if (autoAcceptDue(t.submitted_at, d, now)) {
      // accepted_by bleibt null = automatisch abgenommen
      const { data: done } = await admin
        .from("tasks")
        .update({ status: "done", accepted_at: nowIso, completed_at: nowIso, accepted_via: "auto" })
        .eq("id", t.id)
        .eq("status", "review")
        .select("id");
      if (done?.length) {
        await admin.from("time_entries").update({ ended_at: nowIso }).eq("task_id", t.id).is("ended_at", null);
        if (t.assignee_id) await notifyAccepted(t.assignee_id, t);
        await requestReview(t.id);
        accepted++;
      }
    } else if (reviewReminderDue(t.submitted_at, d, t.review_reminded_at, now)) {
      remind.set(t.firm_id, [...(remind.get(t.firm_id) ?? []), t.id]);
    }
  }
  let reminded = 0;
  for (const [firmId, ids] of remind) {
    const { data: bosses } = await admin.from("members").select("id").eq("firm_id", firmId).eq("role", "boss").eq("notify_done", true).is("archived_at", null);
    await sendPushToMembers((bosses ?? []).map((b) => b.id), (t) => ({
      title: t("push.reviewReminder"),
      body: t("push.reviewReminderBody", { n: ids.length }),
      url: "/boss?status=review",
      tag: "review-reminder",
    }), "task_review");
    await admin.from("tasks").update({ review_reminded_at: nowIso }).in("id", ids);
    reminded += ids.length;
  }
  return { accepted, reminded };
}
