import Link from "next/link";
import { Avatar, OverdueBadge, StatusBadge, UrgentBadge, cx } from "../ui";
import { formatDate, isOverdue } from "@/lib/dates";
import type { Task } from "@/lib/supabase/types";
import type { TFunction } from "@/i18n/config";

export function TaskRow({
  task, href, assigneeName, checklist, t, locale, showAssignee = true,
}: {
  task: Task;
  href: string;
  assigneeName: string | null;
  checklist?: { done: number; total: number };
  t: TFunction;
  locale: string;
  showAssignee?: boolean;
}) {
  const overdue = isOverdue(task);
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-16 items-center gap-3 rounded-[16px] border bg-surface px-4 py-3 transition hover:border-accent/40",
        overdue ? "border-danger/40 bg-danger-soft/40" : "border-line/60",
        task.priority === "urgent" && "border-l-4 border-l-danger",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cx("truncate font-medium", task.status === "done" && "text-muted line-through")}>{task.title}</span>
          {task.priority === "urgent" && <UrgentBadge label={t("priority.urgent")} />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <StatusBadge status={task.status} label={t(`status.${task.status}`)} />
          {overdue && <OverdueBadge label={t("task.overdue")} />}
          <span className={cx(overdue && "font-medium text-danger")}>
            {task.due_date ? formatDate(task.due_date, locale, { day: "2-digit", month: "2-digit" }) : t("task.noDue")}
            {task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ""}
          </span>
          {checklist && checklist.total > 0 && <span>☑ {t("task.progress", checklist)}</span>}
        </div>
      </div>
      {showAssignee && (
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-sm text-muted xl:inline">{assigneeName ?? t("dashboard.unassigned")}</span>
          <Avatar name={assigneeName ?? "–"} />
        </div>
      )}
    </Link>
  );
}
