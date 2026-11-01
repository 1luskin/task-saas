"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { addDays, addMonths, formatDate, intlLocale, startOfMonth, startOfWeek, todayISO } from "@/lib/dates";
import { cx, initials, STATUS_DOT } from "../ui";
import { IconChevronLeft, IconChevronRight } from "../icons";

export interface CalTask {
  id: string;
  title: string;
  status: "new" | "in_progress" | "done";
  priority: "normal" | "urgent";
  due_date: string;
  assigneeName: string | null;
  overdue: boolean;
}

const CHIP: Record<CalTask["status"], string> = {
  new: "bg-[#eceef0] text-[#4b535b] border-[#d9dce0]",
  in_progress: "bg-accent-soft text-accent border-[#c9d3dc]",
  done: "bg-ok-soft text-ok border-[#cdd8d0] line-through decoration-ok/40",
};

export function Calendar({
  tasks, view, anchor, taskHref, compact = false,
}: { tasks: CalTask[]; view: "month" | "week"; anchor: string; taskHref: string; compact?: boolean }) {
  const { t, messages, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = todayISO();
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, CalTask[]>();
    for (const task of tasks) {
      const arr = m.get(task.due_date) ?? [];
      arr.push(task);
      m.set(task.due_date, arr);
    }
    for (const arr of m.values())
      arr.sort((a, b) => Number(b.priority === "urgent") - Number(a.priority === "urgent") || a.status.localeCompare(b.status));
    return m;
  }, [tasks]);

  const days = useMemo(() => {
    if (view === "week") {
      const s = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    const first = startOfMonth(anchor);
    const s = startOfWeek(first);
    const nextMonth = addMonths(first, 1);
    const out: string[] = [];
    for (let d = s; d < nextMonth || out.length % 7 !== 0; d = addDays(d, 1)) out.push(d);
    return out;
  }, [view, anchor]);

  function go(next: { cal?: string; view?: string }) {
    const sp = new URLSearchParams(params.toString());
    if (next.cal) sp.set("cal", next.cal);
    if (next.view) sp.set("view", next.view);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  const title =
    view === "month"
      ? new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${startOfMonth(anchor)}T00:00:00Z`))
      : `${formatDate(days[0]!, locale, { day: "2-digit", month: "2-digit" })} – ${formatDate(days[6]!, locale)}`;

  const maxChips = view === "week" ? 50 : compact ? 2 : 3;
  const selTasks = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="card-white overflow-hidden">
      {/* Kopf */}
      <div className="flex items-center gap-2 border-b border-line/70 px-3 py-2.5">
        <button className="btn-ghost !min-h-10 !px-2" onClick={() => go({ cal: view === "month" ? addMonths(startOfMonth(anchor), -1) : addDays(anchor, -7) })} aria-label={t("calendar.prev")}>
          <IconChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center font-semibold capitalize">{title}</div>
        <button className="btn-ghost !min-h-10 !px-2" onClick={() => go({ cal: view === "month" ? addMonths(startOfMonth(anchor), 1) : addDays(anchor, 7) })} aria-label={t("calendar.next")}>
          <IconChevronRight className="size-5" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button className="btn-secondary !min-h-9 !px-3 text-sm" onClick={() => { go({ cal: today }); setSelected(today); }}>
          {t("calendar.today")}
        </button>
        <div className="inline-flex rounded-[10px] bg-card p-0.5">
          {(["month", "week"] as const).map((v) => (
            <button key={v} onClick={() => go({ view: v })} className={cx("min-h-9 rounded-[8px] px-3 text-sm font-medium", view === v ? "bg-surface shadow-sm" : "text-muted")}>
              {t(`calendar.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Wochentage */}
      <div className="grid grid-cols-7 border-y border-line/70 bg-card/60 text-center text-xs font-medium text-muted">
        {messages.weekdaysShort.map((d) => (
          <div key={d} className="py-1.5">{d}</div>
        ))}
      </div>

      {/* Raster */}
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const list = byDay.get(d) ?? [];
          const inMonth = view === "week" || d.slice(0, 7) === anchor.slice(0, 7);
          const isToday = d === today;
          const isSel = d === selected;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelected(isSel ? null : d)}
              className={cx(
                "group flex flex-col items-stretch gap-1 border-line/60 p-1 text-left transition hover:bg-card",
                i % 7 !== 6 && "border-r",
                i < days.length - 7 && "border-b",
                view === "week" ? "min-h-56" : compact ? "min-h-[88px]" : "min-h-28",
                !inMonth && "bg-card/50",
                isSel && "bg-accent-soft/60",
              )}
            >
              <span
                className={cx(
                  "mx-auto flex size-7 items-center justify-center rounded-full text-sm tabular-nums lg:mx-0",
                  isToday ? "bg-accent font-semibold text-white" : inMonth ? "text-ink" : "text-muted/60",
                )}
              >
                {Number(d.slice(8, 10))}
              </span>
              {/* Handy: nur Punkte */}
              <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                {list.slice(0, 4).map((task) => (
                  <span key={task.id} className={cx("size-1.5 rounded-full", task.overdue ? "bg-danger" : STATUS_DOT[task.status])} />
                ))}
              </span>
              <span className="hidden flex-col gap-0.5 sm:flex">
                {list.slice(0, maxChips).map((task) => (
                  <span
                    key={task.id}
                    title={`${task.assigneeName ?? "—"}: ${task.title}`}
                    className={cx(
                      "flex items-center gap-1 truncate rounded-[6px] border px-1 py-0.5 text-[11px] leading-tight",
                      task.overdue ? "border-danger/30 bg-danger-soft text-danger" : CHIP[task.status],
                      task.priority === "urgent" && "border-l-[3px] border-l-danger",
                    )}
                  >
                    <span className="shrink-0 font-semibold">{initials(task.assigneeName)}</span>
                    <span className="truncate">{task.title}</span>
                  </span>
                ))}
                {list.length > maxChips && <span className="px-1 text-[11px] text-muted">{t("calendar.more", { n: list.length - maxChips })}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ausgewählter Tag */}
      {selected && (
        <div className="border-t border-line/70 p-3">
          <div className="mb-2 text-sm font-semibold">{t("calendar.tasksOn", { date: formatDate(selected, locale) })}</div>
          {selTasks.length === 0 ? (
            <p className="text-sm text-muted">{t("calendar.noTasksDay")}</p>
          ) : (
            <ul className="space-y-1.5">
              {selTasks.map((task) => (
                <li key={task.id}>
                  <Link href={`${taskHref}${task.id}`} className="flex min-h-12 items-center gap-2 rounded-[12px] bg-card px-3 py-2 hover:bg-accent-soft/50 lg:min-h-10">
                    <span className={cx("size-2 shrink-0 rounded-full", task.overdue ? "bg-danger" : STATUS_DOT[task.status])} />
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    {task.priority === "urgent" && <span className="chip bg-danger text-white">!</span>}
                    <span className="shrink-0 text-xs text-muted">{task.assigneeName ?? "—"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
