import Link from "next/link";
import type { Ctx } from "@/lib/auth";
import type { TFunction } from "@/i18n/config";
import { formatDate, formatDuration, isOverdue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { loadTaskDetail } from "@/server/task-detail";
import { Avatar, OverdueBadge, StatusBadge, UrgentBadge, cx } from "../ui";
import { IconChevronLeft, IconClock, IconPin } from "../icons";
import { TaskActions } from "./task-actions";
import { Checklist } from "./checklist";
import { Comments } from "./comments";
import { Photos } from "./photos";

type Detail = NonNullable<Awaited<ReturnType<typeof loadTaskDetail>>>;

export function TaskDetail({
  d, ctx, t, locale, backHref, bossTools,
}: { d: Detail; ctx: Ctx; t: TFunction; locale: string; backHref: string; bossTools?: React.ReactNode }) {
  const { task } = d;
  const isBoss = ctx.member.role === "boss";
  const overdue = isOverdue(task);
  const canWork = task.assignee_id === ctx.member.id;
  const mapUrl = task.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.address)}` : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={backHref} className="inline-flex min-h-10 items-center gap-1 text-muted hover:text-ink">
        <IconChevronLeft className="size-5" />
        {t("common.back")}
      </Link>

      <div className={cx("card-white space-y-4 p-4 sm:p-6", task.priority === "urgent" && "border-l-4 border-l-danger", overdue && "border-danger/40")}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} label={t(`status.${task.status}`)} />
          {task.priority === "urgent" && <UrgentBadge label={t("priority.urgent")} />}
          {overdue && <OverdueBadge label={t("task.overdue")} />}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted">{t("task.dueDate")}</dt>
            <dd className={cx("font-medium", overdue && "text-danger")}>
              {task.due_date ? formatDate(task.due_date, locale) : t("task.noDue")}
              {task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t("task.assignee")}</dt>
            <dd className="flex items-center gap-2 font-medium">
              {d.assignee ? (
                <>
                  <Avatar name={d.assignee.full_name} className="size-6 text-[10px]" />
                  {d.assignee.full_name}
                  {d.assignee.status !== "active" && <span className="chip bg-danger-soft text-danger">{t(`memberStatus.${d.assignee.status}`)}</span>}
                </>
              ) : (
                t("dashboard.unassigned")
              )}
            </dd>
          </div>
        </dl>

        {task.description && <p className="whitespace-pre-wrap break-words">{task.description}</p>}

        <TaskActions
          taskId={task.id}
          status={task.status}
          runningSince={d.runningMine}
          spentMinutes={d.closedMinutesMine}
          canWork={canWork}
        />

        {/* Verdienst / Finanzen */}
        {isBoss ? (
          <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-card p-3 text-sm sm:grid-cols-4">
            <div><div className="text-muted">{t("task.timeSpent")}</div><div className="font-semibold">{formatDuration(d.pay.minutes)}</div></div>
            <div><div className="text-muted">{t("task.clientPrice")}</div><div className="font-semibold">{formatMoney(d.clientPriceCents, locale)}</div></div>
            <div><div className="text-muted">{t("task.payout")}</div><div className="font-semibold">{formatMoney(d.pay.totalCents + (task.status === "done" ? 0 : task.fixed_pay_cents ?? 0), locale)}</div></div>
            <div><div className="text-muted">{t("task.profit")}</div><div className="font-semibold text-accent">{formatMoney(d.clientPriceCents - d.pay.totalCents - (task.status === "done" ? 0 : task.fixed_pay_cents ?? 0), locale)}</div></div>
          </div>
        ) : (
          (d.pay.totalCents > 0 || Boolean(task.fixed_pay_cents)) && (
            <div className="flex items-center justify-between rounded-[16px] bg-card p-3">
              <span className="flex items-center gap-2 text-muted"><IconClock className="size-5" />{t("task.earned")}</span>
              <span className="text-lg font-semibold">
                {formatMoney(d.pay.totalCents, locale)}
                {task.status !== "done" && task.fixed_pay_cents ? <span className="ml-1 text-sm font-normal text-muted">(+{formatMoney(task.fixed_pay_cents, locale)})</span> : null}
              </span>
            </div>
          )
        )}
      </div>

      <div className="card-white p-4 sm:p-6">
        <Checklist taskId={task.id} status={task.status} items={d.checklist} editable={isBoss} />
      </div>

      <details className="card-white" open={Boolean(task.address || d.photos.length)}>
        <summary className="flex min-h-14 cursor-pointer items-center px-4 font-semibold sm:px-6">{t("task.more")}</summary>
        <div className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
          {task.address && (
            <div>
              <div className="mb-1 font-medium">{t("task.address")}</div>
              <a href={mapUrl!} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-2 rounded-[14px] bg-card px-3 text-accent">
                <IconPin className="size-5 shrink-0" />
                <span className="flex-1">{task.address}</span>
                <span className="text-sm">{t("task.openMap")} ↗</span>
              </a>
            </div>
          )}
          <Photos taskId={task.id} firmId={ctx.firm.id} photos={d.photos} myMemberId={ctx.member.id} isBoss={isBoss} />
        </div>
      </details>

      <div className="card-white p-4 sm:p-6">
        <Comments taskId={task.id} comments={d.comments} myMemberId={ctx.member.id} isBoss={isBoss} />
      </div>

      {bossTools}
    </div>
  );
}
