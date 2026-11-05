"use client";
import type { TaskStatus } from "@/lib/supabase/types";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { addDays, addMonths, formatDate, intlLocale, startOfMonth, startOfWeek, todayISO } from "@/lib/dates";
import { cx, initials, STATUS_DOT } from "../ui";
import { moveTaskDate } from "@/server/actions/views";
import { IconChevronLeft, IconChevronRight } from "../icons";

export interface CalTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: "normal" | "urgent";
  due_date: string;
  assigneeName: string | null;
  overdue: boolean;
}

const CHIP: Record<CalTask["status"], string> = {
  new: "bg-surface-3 text-ink-2",
  in_progress: "bg-accent-soft text-link",
  review: "bg-review-soft text-review",
  rework: "bg-danger-soft text-danger",
  done: "bg-ok-soft text-ok line-through decoration-ok/40",
};

export interface CalAbsence { name: string; from: string; to: string }

export function Calendar({
  tasks: initialTasks, view, anchor, taskHref, compact = false, draggable = false, absences = [],
}: { tasks: CalTask[]; view: "month" | "week" | "day"; anchor: string; taskHref: string; compact?: boolean; draggable?: boolean; absences?: CalAbsence[] }) {
  const awayOn = (d: string) => absences.filter((a) => a.from <= d && a.to >= d);
  const [tasks, setTasks] = useState(initialTasks);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; moved: boolean; sx: number; sy: number } | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const dayAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest("[data-day]")?.getAttribute("data-day") ?? null;
  async function moveTo(id: string, day: string) {
    const prev = tasks;
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, due_date: day } : x)));
    const r = await moveTaskDate(id, day);
    if (!r.ok) setTasks(prev);
  }
  const chipHandlers = (task: CalTask) =>
    draggable
      ? {
          onPointerDown: (e: React.PointerEvent) => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDrag({ id: task.id, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false });
          },
          onPointerMove: (e: React.PointerEvent) => {
            if (!drag || drag.id !== task.id) return;
            const moved = drag.moved || Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 6;
            setDrag({ ...drag, x: e.clientX, y: e.clientY, moved });
            if (moved) setOverDay(dayAt(e.clientX, e.clientY));
          },
          onPointerUp: (e: React.PointerEvent) => {
            e.stopPropagation();
            const d = drag?.moved ? dayAt(e.clientX, e.clientY) : null;
            setDrag(null);
            setOverDay(null);
            if (d && d !== task.due_date) void moveTo(task.id, d);
          },
          onClick: (e: React.MouseEvent) => { if (drag?.moved) e.stopPropagation(); },
          style: drag?.id === task.id && drag.moved ? ({ position: "fixed", left: drag.x - 40, top: drag.y - 10, width: 140, zIndex: 60, pointerEvents: "none" } as React.CSSProperties) : undefined,
        }
      : {};
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
    if (view === "day") return [anchor];
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
    view === "day"
      ? formatDate(anchor, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : view === "month"
      ? new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${startOfMonth(anchor)}T00:00:00Z`))
      : `${formatDate(days[0]!, locale, { day: "2-digit", month: "2-digit" })} – ${formatDate(days[6]!, locale)}`;

  const maxChips = view === "week" ? 50 : compact ? 2 : 3;
  const selTasks = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="card-white overflow-hidden">
      {/* Kopf */}
      <div className="flex items-center gap-2 border-b border-line/70 px-3 py-2.5">
        <button className="btn-ghost !min-h-10 !px-2" onClick={() => go({ cal: view === "month" ? addMonths(startOfMonth(anchor), -1) : addDays(anchor, view === "day" ? -1 : -7) })} aria-label={t("calendar.prev")}>
          <IconChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center font-semibold capitalize">{title}</div>
        <button className="btn-ghost !min-h-10 !px-2" onClick={() => go({ cal: view === "month" ? addMonths(startOfMonth(anchor), 1) : addDays(anchor, view === "day" ? 1 : 7) })} aria-label={t("calendar.next")}>
          <IconChevronRight className="size-5" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button className="btn-secondary !min-h-9 !px-3 text-sm" onClick={() => { go({ cal: today }); setSelected(today); }}>
          {t("calendar.today")}
        </button>
        <div className="inline-flex rounded-[10px] bg-card p-0.5">
          {(["month", "week", "day"] as const).map((v) => (
            <button key={v} onClick={() => go({ view: v })} className={cx("min-h-9 rounded-[8px] px-3 text-sm font-medium", view === v ? "bg-surface-3 text-ink" : "text-muted")}>
              {v === "day" ? t("views.day") : t(`calendar.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {view === "day" && (
        <ul className="space-y-1.5 p-3">
          {awayOn(anchor).map((a) => (
            <li key={a.name} className="hatch rounded-[12px] bg-card px-3 py-2 text-sm text-muted">{t("calendar.away", { name: a.name })}</li>
          ))}
          {(byDay.get(anchor) ?? []).map((task) => (
            <li key={task.id}>
              <Link href={`${taskHref}${task.id}`} className="flex min-h-12 items-center gap-2 rounded-[12px] bg-card px-3 py-2 hover:bg-surface-3">
                <span className={cx("size-2 shrink-0 rounded-full", task.overdue ? "bg-danger" : STATUS_DOT[task.status])} />
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                {task.priority === "urgent" && <span className="chip bg-danger-soft text-danger">!</span>}
                <span className="shrink-0 text-xs text-muted">{task.assigneeName ?? "—"}</span>
              </Link>
            </li>
          ))}
          {!(byDay.get(anchor) ?? []).length && <li className="text-sm text-muted">{t("calendar.noTasksDay")}</li>}
        </ul>
      )}
      {view !== "day" && <>
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
          const away = awayOn(d);
          return (
            <button
              key={d}
              type="button"
              data-day={d}
              onClick={() => setSelected(isSel ? null : d)}
              className={cx(
                "group flex flex-col items-stretch gap-1 border-line/50 p-1 text-left transition hover:bg-card",
                i % 7 !== 6 && "border-r",
                i < days.length - 7 && "border-b",
                view === "week" ? "min-h-56" : compact ? "min-h-[88px]" : "min-h-28",
                !inMonth && "bg-card/50",
                isSel && "bg-accent-soft/60",
                away.length > 0 && "hatch",
                overDay === d && "ring-2 ring-inset ring-accent-2",
              )}
            >
              <span
                className={cx(
                  "mx-auto flex size-7 items-center justify-center rounded-full text-sm tabular-nums lg:mx-0",
                  isToday ? "bg-accent-2 font-semibold text-bg" : inMonth ? "text-ink" : "text-muted",
                )}
              >
                {Number(d.slice(8, 10))}
              </span>
              {away.length > 0 && (
                <span className="hidden truncate px-1 text-[10px] text-muted sm:block" title={away.map((a) => t("calendar.away", { name: a.name })).join(", ")}>
                  {away.map((a) => initials(a.name)).join(" ")} · {t("calendar.vacation")}
                </span>
              )}
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
                    {...chipHandlers(task)}
                    title={`${task.assigneeName ?? "—"}: ${task.title}`}
                    className={cx(
                      "flex items-center gap-1 truncate rounded-[6px] px-1 py-0.5 text-[11px] leading-tight",
                      task.overdue ? "bg-danger-soft text-danger" : CHIP[task.status],
                      task.priority === "urgent" && "ring-1 ring-danger/50",
                      draggable && "cursor-grab touch-none select-none",
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

      </>}
      {/* Ausgewählter Tag */}
      {selected && (
        <div className="border-t border-line/70 p-3">
          <div className="mb-2 text-sm font-semibold">{t("calendar.tasksOn", { date: formatDate(selected, locale) })}</div>
          {awayOn(selected).length > 0 && <p className="mb-2 text-sm text-muted">{awayOn(selected).map((a) => t("calendar.away", { name: a.name })).join(" · ")}</p>}
          {selTasks.length === 0 ? (
            <p className="text-sm text-muted">{t("calendar.noTasksDay")}</p>
          ) : (
            <ul className="space-y-1.5">
              {selTasks.map((task) => (
                <li key={task.id}>
                  <Link href={`${taskHref}${task.id}`} className="flex min-h-12 items-center gap-2 rounded-[12px] bg-card px-3 py-2 hover:bg-accent-soft/50 lg:min-h-10">
                    <span className={cx("size-2 shrink-0 rounded-full", task.overdue ? "bg-danger" : STATUS_DOT[task.status])} />
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    {task.priority === "urgent" && <span className="chip bg-danger-soft text-danger">!</span>}
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
