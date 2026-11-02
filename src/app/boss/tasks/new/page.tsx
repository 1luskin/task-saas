import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { getMembers } from "@/server/queries";
import { TaskForm } from "@/components/tasks/task-form";
import { emptyTaskForm } from "@/components/tasks/task-form-values";
import { PageTitle } from "@/components/ui";

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const ctx = await requireBossPage();
  const { t } = await getI18n();
  const { date } = await searchParams;
  const members = await getMembers(ctx);
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>{t("task.newTitle")}</PageTitle>
      <div className="card-white p-4 sm:p-6">
        <TaskForm
          initial={{ ...emptyTaskForm, due_date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "" }}
          members={members.map((m) => ({ id: m.id, full_name: m.full_name, status: m.status, pay_mode: m.pay_mode }))}
        />
      </div>
    </div>
  );
}
