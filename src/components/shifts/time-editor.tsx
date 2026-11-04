"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { editTimeRecord } from "@/server/actions/money";
import { berlinLocalToISO, isoToBerlinLocal } from "@/lib/dates";
import { useAction, ErrorText } from "../use-action";
import { Field, Input } from "../ui";

/** Korrektur einer Schicht / eines Zeiteintrags mit Pflicht-Begründung (wird protokolliert) */
export function TimeEditor({ kind, id, startedAt, endedAt, breakMinutes }: { kind: "shift" | "time_entry"; id: string; startedAt: string; endedAt: string | null; breakMinutes: number }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ from: isoToBerlinLocal(startedAt), to: endedAt ? isoToBerlinLocal(endedAt) : "", brk: String(breakMinutes), reason: "" });
  if (!open) return <button className="btn-secondary !min-h-9 !px-3 text-sm" onClick={() => setOpen(true)}>{t("times.edit")}</button>;
  return (
    <form
      className="mt-2 grid w-full gap-2 rounded-[12px] bg-card p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => editTimeRecord({ kind, id, startedAt: berlinLocalToISO(v.from), endedAt: v.to ? berlinLocalToISO(v.to) : null, breakMinutes: Number(v.brk) || 0, reason: v.reason }), { onOk: () => setOpen(false) });
      }}
    >
      <Field label={t("times.from")}><Input type="datetime-local" required value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })} /></Field>
      <Field label={t("times.to")}><Input type="datetime-local" value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })} /></Field>
      {kind === "shift" && <Field label={t("times.breakMin")}><Input type="number" min={0} max={1440} value={v.brk} onChange={(e) => setV({ ...v, brk: e.target.value })} /></Field>}
      <Field label={t("times.reason")} className="sm:col-span-2"><Input required minLength={3} maxLength={500} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></Field>
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{t("common.save")}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
      </div>
      <ErrorText error={error} />
    </form>
  );
}
