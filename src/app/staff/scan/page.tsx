import { requireStaffPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { TaskRow } from "@/components/tasks/task-row";
import { Scanner } from "./scanner";

/** QR scannen → eigene Aufgaben beim Objekt (Kundenname sieht der Mitarbeiter nicht – nur Adresse) */
export default async function ScanPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const ctx = await requireStaffPage();
  const { t, locale } = await getI18n();
  const { client } = await searchParams;
  if (client && /^[0-9a-f-]{36}$/.test(client)) {
    const { data } = await ctx.supabase.from("tasks").select("*").eq("assignee_id", ctx.member.id).eq("client_id", client).neq("status", "done").order("due_date");
    const tasks = data ?? [];
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">{t("qr.tasksFor", { name: tasks[0]?.address ?? "…" })}</h1>
        {tasks.map((task) => <TaskRow key={task.id} task={task} href={`/staff/tasks/${task.id}`} assigneeName={null} t={t} locale={locale} showAssignee={false} />)}
        {!tasks.length && <p className="text-muted">{t("qr.none")}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">{t("qr.scan")}</h1>
      <p className="text-muted">{t("qr.scanHint")}</p>
      <Scanner />
    </div>
  );
}
