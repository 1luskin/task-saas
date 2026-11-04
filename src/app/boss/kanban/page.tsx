import { notFound } from "next/navigation";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { isEnabled } from "@/lib/features";
import { formatDate, isOverdue } from "@/lib/dates";
import { getMembers } from "@/server/queries";
import { Kanban } from "@/components/tasks/kanban";
import { ViewTabs } from "@/components/tasks/view-tabs";
import { PageTitle } from "@/components/ui";

function daysAgoIso(days: number, now = Date.now()) {
  return new Date(now - days * 864e5).toISOString();
}

export default async function KanbanPage() {
  const ctx = await requireBossPage();
  if (!(await isEnabled(ctx, "kanban"))) notFound();
  const { t, locale } = await getI18n();
  const [{ data: statuses }, { data: tasks }, members] = await Promise.all([
    ctx.supabase.from("task_statuses").select("*").eq("firm_id", ctx.firm.id).order("position"),
    // Erledigte nur der letzten 14 Tage, damit die Spalte überschaubar bleibt
    ctx.supabase.from("tasks").select("*").eq("firm_id", ctx.firm.id).or(`status.neq.done,completed_at.gte.${daysAgoIso(14)}`).limit(500),
    getMembers(ctx, { includeArchived: true }),
  ]);
  const cols = statuses ?? [];
  const systemCol = (kind: string) => cols.find((c) => c.is_system && c.kind === kind)?.id ?? cols[0]?.id ?? "";
  const cards = (tasks ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    column: task.custom_status_id && cols.some((c) => c.id === task.custom_status_id) ? task.custom_status_id : systemCol(task.status),
    assigneeName: members.find((m) => m.id === task.assignee_id)?.full_name ?? null,
    urgent: task.priority === "urgent",
    overdue: isOverdue(task),
    due: task.due_date ? formatDate(task.due_date, locale, { day: "2-digit", month: "2-digit" }) : null,
  }));
  return (
    <div className="space-y-4">
      <PageTitle actions={<ViewTabs active="kanban" />}>{t("views.kanban")}</PageTitle>
      <Kanban columns={cols.map((c) => ({ id: c.id, name: c.name, color: c.color, kind: c.kind, is_system: c.is_system }))} cards={cards} />
    </div>
  );
}
