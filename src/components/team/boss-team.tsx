"use client";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { isDemo } from "@/lib/demo/mode";
import {
  addPlan, createAnnouncement, decideSwap, decideVacation, deleteAnnouncement, deleteDocument, deletePlan, saveDocument, setVacationDays,
} from "@/server/actions/team";
import { useAction, ErrorText } from "../use-action";
import { Field, Input, Select, Textarea } from "../ui";
import { IconTrash } from "../icons";

type Opt = { id: string; name: string };

export function PlanForm({ members, defaultDate }: { members: Opt[]; defaultDate: string }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState({ memberId: members[0]?.id ?? "", date: defaultDate, start: "07:00", end: "16:00", note: "" });
  return (
    <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_.7fr_.7fr_auto] xl:items-end" onSubmit={(e) => { e.preventDefault(); run(() => addPlan(v)); }}>
      <Field label={t("employees.name")}>
        <Select value={v.memberId} onChange={(e) => setV({ ...v, memberId: e.target.value })}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
      </Field>
      <Field label={t("team.date")}><Input type="date" required value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
      <Field label={t("team.from")}><Input type="time" required value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} /></Field>
      <Field label={t("team.to")}><Input type="time" required value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} /></Field>
      <button className="btn-primary" disabled={pending || !v.memberId}>{t("team.addPlan")}</button>
      <ErrorText error={error} />
    </form>
  );
}

export function DeletePlan({ id, label }: { id: string; label: string }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <button className="group flex w-full items-center justify-between gap-1 rounded-[8px] bg-accent-soft px-2 py-1 text-left text-xs text-link" disabled={pending} title={t("common.delete")} onClick={() => confirm(t("common.confirmDelete")) && run(() => deletePlan(id))}>
      <span className="tabular-nums">{label}</span>
      <IconTrash className="size-3.5 opacity-0 group-hover:opacity-100" />
    </button>
  );
}

export function SwapDecide({ id }: { id: string }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  return (
    <span className="flex flex-wrap gap-2">
      <button className="btn-primary !min-h-9 !px-3 text-sm" disabled={pending} onClick={() => run(() => decideSwap(id, "approve"))}>{t("team.approve")}</button>
      <button className="btn-secondary !min-h-9 !px-3 text-sm" disabled={pending} onClick={() => run(() => decideSwap(id, "reject"))}>{t("team.reject")}</button>
      <ErrorText error={error} />
    </span>
  );
}

export function VacationDecide({ id }: { id: string }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  return (
    <span className="flex flex-wrap gap-2">
      <button className="btn-primary !min-h-9 !px-3 text-sm" disabled={pending} onClick={() => run(() => decideVacation(id, true))}>{t("team.approve")}</button>
      <button className="btn-secondary !min-h-9 !px-3 text-sm" disabled={pending} onClick={() => run(() => decideVacation(id, false))}>{t("team.reject")}</button>
      <ErrorText error={error} />
    </span>
  );
}

export function VacationDays({ memberId, value }: { memberId: string; value: number }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState(String(value));
  return (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); run(() => setVacationDays(memberId, Number(v))); }}>
      <Input aria-label={t("team.perYear")} type="number" min={0} max={60} className="!min-h-9 w-20" value={v} onChange={(e) => setV(e.target.value)} />
      {String(value) !== v && <button className="btn-secondary !min-h-9 !px-3 text-sm" disabled={pending}>{t("common.save")}</button>}
      <ErrorText error={error} />
    </form>
  );
}

export function AnnouncementForm({ groups }: { groups: Opt[] }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState({ title: "", body: "", groupId: "" });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => createAnnouncement({ ...v, groupId: v.groupId || null }), { onOk: () => setV({ title: "", body: "", groupId: "" }) }); }}>
      <Field label={t("team.annTitle")}><Input required maxLength={160} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
      <Field label={t("team.body")}><Textarea required maxLength={5000} rows={4} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} /></Field>
      {groups.length > 0 && (
        <Field label={t("employees.group")}>
          <Select value={v.groupId} onChange={(e) => setV({ ...v, groupId: e.target.value })}>
            <option value="">{t("team.allGroups")}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
      )}
      <ErrorText error={error} />
      <button className="btn-primary" disabled={pending}>{t("team.post")}</button>
    </form>
  );
}

export function DeleteButton({ id, kind }: { id: string; kind: "announcement" | "document" }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <button className="btn-ghost !min-h-9 !px-2 text-muted" aria-label={t("common.delete")} disabled={pending}
      onClick={() => confirm(t("common.confirmDelete")) && run(() => (kind === "announcement" ? deleteAnnouncement(id) : deleteDocument(id)))}>
      <IconTrash className="size-4" />
    </button>
  );
}

export function DocumentForm({ members, firmId }: { members: Opt[]; firmId: string }) {
  const { t } = useI18n();
  const { run, pending, error, setError } = useAction();
  const [v, setV] = useState({ memberId: members[0]?.id ?? "", name: "", expiresOn: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let filePath: string | null = null;
    const file = fileRef.current?.files?.[0];
    if (file && !isDemo()) {
      if (file.size > 10 * 1024 * 1024) return setError(t("common.invalid"));
      const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
      filePath = `${firmId}/${v.memberId}/${crypto.randomUUID()}.${ext}`;
      const up = await createClient().storage.from("member-docs").upload(filePath, file, { contentType: file.type });
      if (up.error) return setError(t("common.error"));
    }
    run(() => saveDocument({ memberId: v.memberId, name: v.name, expiresOn: v.expiresOn || null, filePath }), {
      onOk: () => { setV({ ...v, name: "", expiresOn: "" }); if (fileRef.current) fileRef.current.value = ""; },
    });
  }
  return (
    <form className="space-y-3" onSubmit={submit}>
      <Field label={t("employees.name")}>
        <Select value={v.memberId} onChange={(e) => setV({ ...v, memberId: e.target.value })}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
      </Field>
      <Field label={t("team.docName")}><Input required maxLength={120} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label={t("team.expires")}><Input type="date" value={v.expiresOn} onChange={(e) => setV({ ...v, expiresOn: e.target.value })} /></Field>
      {!isDemo() && <Field label={t("team.file")}><input ref={fileRef} type="file" accept="application/pdf,image/*" className="block w-full text-sm" /></Field>}
      <ErrorText error={error} />
      <button className="btn-primary" disabled={pending || !v.memberId}>{t("common.save")}</button>
    </form>
  );
}
