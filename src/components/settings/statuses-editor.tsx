"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { deleteTaskStatus, saveTaskStatus, setAutoAcceptDays } from "@/server/actions/statuses";
import type { StatusColor, TaskStatus, TaskStatusRow } from "@/lib/supabase/types";
import { useAction, ErrorText } from "../use-action";
import { IconTrash } from "../icons";
import { Select, cx } from "../ui";

export const STATUS_COLORS: Record<StatusColor, string> = {
  slate: "bg-surface-3 text-ink-2",
  blue: "bg-accent-soft text-link",
  amber: "bg-review-soft text-review",
  red: "bg-danger-soft text-danger",
  green: "bg-ok-soft text-ok",
  violet: "bg-[#3a3346] text-[#cbbbe6]",
  teal: "bg-[#2b3d3d] text-[#a3cfcb]",
};

function Row({ st }: { st: TaskStatusRow }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [name, setName] = useState(st.name);
  const [color, setColor] = useState<StatusColor>(st.color);
  const dirty = name !== st.name || color !== st.color;
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-[12px] bg-card p-2">
      <span className={cx("chip", STATUS_COLORS[color])}>{name || "…"}</span>
      <input className="input !min-h-10 min-w-0 flex-1" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label={t("employees.name")} />
      <select className="input !min-h-10 !w-auto" value={color} onChange={(e) => setColor(e.target.value as StatusColor)} aria-label="Farbe">
        {(Object.keys(STATUS_COLORS) as StatusColor[]).map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <span className="text-xs text-muted">{t(`status.${st.kind}`)}</span>
      {dirty && <button className="btn-primary !min-h-10 text-sm" disabled={pending} onClick={() => run(() => saveTaskStatus(st.id, { name, color }))}>{t("common.save")}</button>}
      {!st.is_system && (
        <button className="btn-ghost !min-h-10 !px-2 text-muted" aria-label={t("common.delete")} onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteTaskStatus(st.id))}>
          <IconTrash className="size-4" />
        </button>
      )}
      <ErrorText error={error} />
    </li>
  );
}

export function StatusesEditor({ statuses, autoAcceptDays }: { statuses: TaskStatusRow[]; autoAcceptDays: number | null }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TaskStatus>("in_progress");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">{t("settings.statuses")}</h2>
        <p className="text-sm text-muted">{t("settings.statusesHint")}</p>
      </div>
      <ul className="space-y-2">
        {statuses.map((st) => <Row key={st.id} st={st} />)}
      </ul>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run(() => saveTaskStatus(null, { name, color: "violet", kind }), { onOk: () => setName("") }); }}>
        <input className="input min-w-0 flex-1" placeholder={t("settings.addStatus")} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <Select className="!w-auto" value={kind} onChange={(e) => setKind(e.target.value as TaskStatus)} aria-label={t("settings.stage")}>
          {(["new", "in_progress", "review", "rework", "done"] as const).map((k) => <option key={k} value={k}>{t(`status.${k}`)}</option>)}
        </Select>
        <button className="btn-secondary" disabled={pending}>+</button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <span className="font-medium">{t("settings.autoAccept")}</span>
        <Select
          className="!w-auto"
          aria-label={t("settings.autoAcceptDays")}
          defaultValue={autoAcceptDays ?? ""}
          onChange={(e) => run(() => setAutoAcceptDays(e.target.value ? Number(e.target.value) : null))}
        >
          <option value="">{t("settings.autoAcceptOff")}</option>
          {[1, 2, 3, 5, 7, 14].map((d) => <option key={d} value={d}>{d} d</option>)}
        </Select>
      </div>
    </div>
  );
}
