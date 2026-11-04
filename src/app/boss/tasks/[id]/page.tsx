import { notFound } from "next/navigation";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { loadTaskDetail } from "@/server/task-detail";
import { getMembers } from "@/server/queries";
import { TaskDetail } from "@/components/tasks/task-detail";
import { isEnabled } from "@/lib/features";
import { BossTaskTools } from "@/components/tasks/boss-task-tools";
import { centsToInput } from "@/lib/money";

export default async function BossTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireBossPage();
  const { t, locale } = await getI18n();
  const [d, members] = await Promise.all([loadTaskDetail(ctx, id), getMembers(ctx)]);
  if (!d) notFound();
  const { task } = d;
  return (
    <TaskDetail
      d={d}
      ctx={ctx}
      t={t}
      locale={locale}
      backHref="/boss"
      expensesOn={await isEnabled(ctx, "expenses")}
      bossTools={
        <BossTaskTools
          taskId={task.id}
          fields={ctx.firm.task_fields}
          members={members.map((m) => ({ id: m.id, full_name: m.full_name, status: m.status, pay_mode: m.pay_mode }))}
          initial={{
            title: task.title,
            description: task.description ?? "",
            assignee_id: task.assignee_id ?? "",
            due_date: task.due_date ?? "",
            due_time: task.due_time?.slice(0, 5) ?? "",
            priority: task.priority,
            status: task.status,
            address: task.address ?? "",
            client_price: centsToInput(d.clientPriceCents),
            fixed_pay: centsToInput(task.fixed_pay_cents),
            checklist: "",
          }}
        />
      }
    />
  );
}
