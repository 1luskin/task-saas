import Link from "next/link";
import type { TFunction } from "@/i18n/config";
import type { Task } from "@/lib/supabase/types";
import { formatDate, isOverdue } from "@/lib/dates";
import { OverdueBadge, StatusBadge, UrgentBadge, cx } from "../ui";
import { IconPin } from "../icons";
import { TaskActions } from "./task-actions";

/** Große Aufgabenkarte für Mitarbeiter (Handschuh-tauglich). */
export function StaffTaskCard({
  task, t, locale, runningSince, spentMinutes, checklist,
}: { task: Task; t: TFunction; locale: string; runningSince: string | null; spentMinutes: number; checklist?: { done: number; total: number } }) {
  const overdue = isOverdue(task);
  return (
    <div className={cx("card-white overflow-hidden", task.priority === "urgent" && "border-l-[6px] border-l-danger", overdue && "border-danger/40")}>
      <Link href={`/staff/tasks/${task.id}`} className="block p-4 pb-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={task.status} label={t(`status.${task.status}`)} />
          {task.priority === "urgent" && <UrgentBadge label={t("priority.urgent")} />}
          {overdue && <OverdueBadge label={t("task.overdue")} />}
        </div>
        <div className={cx("text-xl font-semibold leading-snug", task.status === "done" && "text-muted line-through")}>{task.title}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-muted">
          <span className={cx(overdue && "text-danger")}>
            {task.due_date ? formatDate(task.due_date, locale, { weekday: "short", day: "2-digit", month: "2-digit" }) : t("task.noDue")}
            {task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ""}
          </span>
          {checklist && checklist.total > 0 && <span>☑ {t("task.progress", checklist)}</span>}
        </div>
        {task.address && (
          <div className="mt-1 flex items-center gap-1 text-muted">
            <IconPin className="size-4 shrink-0" />
            <span className="truncate">{task.address}</span>
          </div>
        )}
      </Link>
      <div className="p-4 pt-2">
        <TaskActions taskId={task.id} status={task.status} runningSince={runningSince} spentMinutes={spentMinutes} canWork />
      </div>
    </div>
  );
}
