"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { bulkDelete, bulkUpdate, duplicateTasks, setPinned } from "@/server/actions/views";
import { formatDate } from "@/lib/dates";
import type { TaskStatus } from "@/lib/supabase/types";
import { useAction, ErrorText } from "../use-action";
import { Avatar, OverdueBadge, StatusBadge, UrgentBadge, cx } from "../ui";
import { IconChecklist, IconPinned } from "../icons";

export interface ListRow {
  id: string; title: string; status: TaskStatus; priority: "normal" | "urgent"; due_date: string | null; due_time: string | null;
  assigneeName: string | null; overdue: boolean; pinned: boolean; checklist?: { done: number; total: number }; statusLabel?: string;
}

export function BulkTaskList({ rows, members }: { rows: ListRow[]; members: { id: string; full_name: string; status: string }[] }) {
  const { t, locale } = useI18n();
  const { run, pending, error } = useAction();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = [...sel];
  const done = () => setSel(new Set());

  return (
    <div className="space-y-2">
      {sel.size > 0 && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-[16px] bg-surface-3 p-2 shadow-lg shadow-black/30 lg:top-2">
          <span className="px-2 text-sm font-medium">{t("views.selected", { n: sel.size })}</span>
          <select className="input !min-h-10 !w-auto text-sm" defaultValue="" aria-label={t("views.assign")} onChange={(e) => { if (e.target.value) run(() => bulkUpdate(ids, { assignee_id: e.target.value === "none" ? null : e.target.value }), { onOk: done }); e.target.value = ""; }}>
            <option value="" disabled>{t("views.assign")}</option>
            <option value="none">{t("dashboard.unassigned")}</option>
            {members.filter((m) => m.status === "active").map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
          <input type="date" className="input !min-h-10 !w-auto text-sm" aria-label={t("views.setDue")} onChange={(e) => e.target.value && run(() => bulkUpdate(ids, { due_date: e.target.value }), { onOk: done })} />
          <select className="input !min-h-10 !w-auto text-sm" defaultValue="" aria-label={t("views.setStatus")} onChange={(e) => { if (e.target.value) run(() => bulkUpdate(ids, { status: e.target.value }), { onOk: done }); e.target.value = ""; }}>
            <option value="" disabled>{t("views.setStatus")}</option>
            {(["new", "in_progress", "review", "rework", "done"] as const).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
          <button className="btn-secondary !min-h-10 text-sm" disabled={pending} onClick={() => run(() => duplicateTasks(ids), { onOk: done })}>{t("views.duplicate")}</button>
          <button className="btn-danger !min-h-10 text-sm" disabled={pending} onClick={() => confirm(t("common.confirmDelete")) && run(() => bulkDelete(ids), { onOk: done })}>{t("views.delete")}</button>
          <button className="btn-ghost !min-h-10 text-sm" onClick={done}>{t("views.clear")}</button>
          <ErrorText error={error} />
        </div>
      )}
      {rows.map((task) => (
        <div key={task.id} className={cx("fade-up flex min-h-16 items-center gap-2 rounded-[14px] bg-surface pl-2 pr-3 transition hover:bg-card", task.overdue && "ring-1 ring-danger/30", sel.has(task.id) && "ring-1 ring-accent-2")}>
          <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
            <input type="checkbox" className="size-5 accent-[#7e9bb3]" checked={sel.has(task.id)} onChange={() => toggle(task.id)} aria-label={task.title} />
          </label>
          <button
            type="button"
            className={cx("flex size-9 shrink-0 items-center justify-center rounded-full", task.pinned ? "text-link" : "text-muted/50 hover:text-muted")}
            aria-label={task.pinned ? t("views.unpin") : t("views.pin")}
            aria-pressed={task.pinned}
            onClick={() => run(() => setPinned(task.id, !task.pinned))}
          >
            <IconPinned className="size-4" />
          </button>
          <Link href={`/boss/tasks/${task.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cx("truncate font-medium", task.status === "done" && "text-muted line-through")}>{task.title}</span>
                {task.priority === "urgent" && <UrgentBadge label={t("priority.urgent")} />}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <StatusBadge status={task.status} label={task.statusLabel ?? t(`status.${task.status}`)} />
                {task.overdue && <OverdueBadge label={t("task.overdue")} />}
                <span className={cx("tabular-nums", task.overdue && "font-medium text-danger")}>
                  {task.due_date ? formatDate(task.due_date, locale, { day: "2-digit", month: "2-digit" }) : t("task.noDue")}
                  {task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ""}
                </span>
                {task.checklist && task.checklist.total > 0 && <span className="inline-flex items-center gap-1 tabular-nums"><IconChecklist className="size-4" />{t("task.progress", task.checklist)}</span>}
              </div>
            </div>
            <span className="hidden text-sm text-muted xl:inline">{task.assigneeName ?? t("dashboard.unassigned")}</span>
            <Avatar name={task.assigneeName ?? "–"} />
          </Link>
        </div>
      ))}
    </div>
  );
}
