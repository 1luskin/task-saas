import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { berlinLocalToISO, todayISO, addDays } from "@/lib/dates";
import { sendPushToMembers } from "@/lib/push";

/** Mitarbeiter: Erinnerung ca. 1 Stunde vor Termin (nur Aufgaben mit Uhrzeit, einmalig) */
export async function runReminderJobs(now = Date.now()) {
  const admin = createAdminClient();
  const today = todayISO();
  const { data: tasks } = await admin
    .from("tasks")
    .select("id, title, assignee_id, due_date, due_time, status")
    .in("due_date", [today, addDays(today, 1)])
    .not("due_time", "is", null)
    .is("reminder_sent_at", null)
    .in("status", ["new", "in_progress", "rework"]);
  let sent = 0;
  for (const t of tasks ?? []) {
    if (!t.assignee_id || !t.due_date || !t.due_time) continue;
    const due = new Date(berlinLocalToISO(`${t.due_date}T${t.due_time.slice(0, 5)}`)).getTime();
    const mins = (due - now) / 60000;
    if (mins > 75 || mins < 0) continue;
    await sendPushToMembers([t.assignee_id], (tr) => ({ title: tr("push.dueSoon"), body: `${t.due_time!.slice(0, 5)} · ${t.title}`, url: `/staff/tasks/${t.id}`, tag: `due-${t.id}` }));
    await admin.from("tasks").update({ reminder_sent_at: new Date(now).toISOString() }).eq("id", t.id);
    sent++;
  }
  return { sent };
}
