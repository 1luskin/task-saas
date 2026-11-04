import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPushToMembers } from "@/lib/push";

/** Mitarbeiter bekommt IMMER eine Benachrichtigung über eine neue Aufgabe. */
export async function notifyNewTask(assigneeId: string, task: { id: string; title: string; priority: string }) {
  await sendPushToMembers([assigneeId], (t) => ({
    title: task.priority === "urgent" ? `${t("priority.urgent")}: ${t("push.newTask")}` : t("push.newTask"),
    body: task.title,
    url: `/staff/tasks/${task.id}`,
    tag: `task-${task.id}`,
  }));
}

/** Chefs mit aktivierter Option "Erledigt" informieren. */
export async function notifyTaskDone(firmId: string, task: { id: string; title: string }, byName: string) {
  const admin = createAdminClient();
  const { data: bosses } = await admin
    .from("members")
    .select("id")
    .eq("firm_id", firmId)
    .eq("role", "boss")
    .eq("notify_done", true)
    .is("archived_at", null);
  await sendPushToMembers((bosses ?? []).map((b) => b.id), (t) => ({
    title: t("push.taskDone"),
    body: t("push.doneBody", { name: byName, title: task.title }),
    url: `/boss/tasks/${task.id}`,
    tag: `done-${task.id}`,
  }));
}
