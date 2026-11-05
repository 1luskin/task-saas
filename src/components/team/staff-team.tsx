"use client";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { isDemo } from "@/lib/demo/mode";
import { compressImage } from "@/lib/image";
import { putOfflineFile } from "@/lib/offline/files";
import { createDailyReport, decideSwap, deleteMyVacation, markAnnouncementRead, requestSwap, requestVacation } from "@/server/actions/team";
import { useAction, ErrorText } from "../use-action";
import { Field, Input, Select, Textarea } from "../ui";
import { IconTrash } from "../icons";

type Opt = { id: string; name: string };

export function SwapRequest({ planId, colleagues }: { planId: string; colleagues: Opt[] }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [to, setTo] = useState("");
  if (!colleagues.length) return null;
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (to) run(() => requestSwap(planId, to)); }}>
      <Select aria-label={t("team.colleague")} className="!min-h-11 min-w-0 flex-1" value={to} onChange={(e) => setTo(e.target.value)}>
        <option value="">{t("team.swap")}</option>
        {colleagues.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      {to && <button className="btn-secondary !min-h-11 text-sm" disabled={pending}>{t("team.send")}</button>}
      <ErrorText error={error} />
    </form>
  );
}

export function SwapAnswer({ id }: { id: string }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  return (
    <span className="flex flex-wrap gap-2">
      <button className="btn-primary !min-h-11 !px-4" disabled={pending} onClick={() => run(() => decideSwap(id, "accept"))}>{t("team.accept")}</button>
      <button className="btn-secondary !min-h-11 !px-4" disabled={pending} onClick={() => run(() => decideSwap(id, "reject"))}>{t("team.reject")}</button>
      <ErrorText error={error} />
    </span>
  );
}

export function VacationForm({ today }: { today: string }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState({ from: today, to: today, note: "" });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => requestVacation(v), { onOk: () => setV({ from: today, to: today, note: "" }) }); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("team.from")}><Input type="date" required min={today} value={v.from} onChange={(e) => setV({ ...v, from: e.target.value, to: v.to < e.target.value ? e.target.value : v.to })} /></Field>
        <Field label={t("team.to")}><Input type="date" required min={v.from} value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })} /></Field>
      </div>
      <Field label={t("team.note")}><Input maxLength={500} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      <ErrorText error={error} />
      <button className="btn-primary w-full" disabled={pending}>{t("team.requestVacation")}</button>
    </form>
  );
}

export function DeleteVacation({ id }: { id: string }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <button className="btn-ghost !min-h-11 min-w-11 !px-2 text-muted" aria-label={t("common.delete")} disabled={pending} onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteMyVacation(id))}>
      <IconTrash className="size-4" />
    </button>
  );
}

export function MarkRead({ id }: { id: string }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return <button className="btn-secondary !min-h-11 text-sm" disabled={pending} onClick={() => run(() => markAnnouncementRead(id))}>{t("team.markRead")}</button>;
}

export function DailyReportForm({ firmId, memberId, today, tasks }: { firmId: string; memberId: string; today: string; tasks: Opt[] }) {
  const { t } = useI18n();
  const { run, pending, error, setError } = useAction();
  const [v, setV] = useState({ taskId: "", done: "", problems: "" });
  const [ok, setOk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOk(false);
    const id = crypto.randomUUID(); // Client-ID → idempotent bei Offline-Wiederholung
    const files = Array.from(fileRef.current?.files ?? []).slice(0, 10);
    const blobs = await Promise.all(files.map((f) => compressImage(f)));
    const reset = () => { setV({ taskId: "", done: "", problems: "" }); if (fileRef.current) fileRef.current.value = ""; setOk(true); };
    if (!navigator.onLine) {
      await putOfflineFile({ id, kind: "report", firmId, memberId, date: today, taskId: v.taskId || null, done: v.done, problems: v.problems, blobs, createdAt: new Date().toISOString() });
      reset();
      return setError(t("offline.filesQueued", { n: 1 }));
    }
    const photoPaths: string[] = [];
    if (!isDemo()) {
      const sb = createClient();
      for (const [i, b] of blobs.entries()) {
        const path = `${firmId}/${memberId}/${id}-${i}.jpg`;
        const up = await sb.storage.from("report-photos").upload(path, b, { contentType: "image/jpeg", upsert: true });
        if (up.error) return setError(t("common.error"));
        photoPaths.push(path);
      }
    }
    run(() => createDailyReport({ id, date: today, taskId: v.taskId || null, done: v.done, problems: v.problems, photoPaths }), { onOk: reset });
  }
  return (
    <form className="space-y-3" onSubmit={submit}>
      {tasks.length > 0 && (
        <Field label={t("team.task")}>
          <Select value={v.taskId} onChange={(e) => setV({ ...v, taskId: e.target.value })}>
            <option value="">—</option>
            {tasks.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label={t("team.done")}><Textarea required maxLength={5000} rows={3} value={v.done} onChange={(e) => setV({ ...v, done: e.target.value })} /></Field>
      <Field label={t("team.problems")}><Textarea maxLength={3000} rows={2} value={v.problems} onChange={(e) => setV({ ...v, problems: e.target.value })} /></Field>
      {!isDemo() && <Field label={t("team.photos")}><input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="block w-full text-sm" /></Field>}
      <ErrorText error={error} />
      {ok && !error && <p className="text-sm text-ok">{t("team.sent")}</p>}
      <button className="btn-primary w-full" disabled={pending}>{t("team.send")}</button>
    </form>
  );
}
