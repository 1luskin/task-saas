"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { isDemo } from "@/lib/demo/mode";
import { compressImage } from "@/lib/image";
import { formatDateTime } from "@/lib/dates";
import { setTaskArticle, submitForm } from "@/server/actions/team";
import type { FormTemplate } from "@/lib/supabase/types";
import { useAction, ErrorText } from "../use-action";
import { Field, Input, Select } from "../ui";
import { IconDownload } from "../icons";

type Sub = { id: string; template_id: string; created_at: string };

export function TaskForms({ taskId, firmId, templates, submissions, canFill }: { taskId: string; firmId: string; templates: FormTemplate[]; submissions: Sub[]; canFill: boolean }) {
  const { t, locale } = useI18n();
  const { run, pending, error, setError } = useAction();
  const [tplId, setTplId] = useState("");
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const tpl = templates.find((x) => x.id === tplId);
  const name = (id: string) => templates.find((x) => x.id === id)?.name ?? "—";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!tpl) return;
    const vals: Record<string, unknown> = { ...values };
    if (!isDemo()) {
      for (const f of tpl.fields.filter((x) => x.type === "photo")) {
        const file = files[f.id];
        if (!file) continue;
        const path = `${firmId}/${taskId}/${crypto.randomUUID()}.jpg`;
        const up = await createClient().storage.from("task-files").upload(path, await compressImage(file), { contentType: "image/jpeg" });
        if (up.error) return setError(t("common.error"));
        vals[f.id] = path;
      }
    }
    run(() => submitForm({ taskId, templateId: tpl.id, values: vals }), { onOk: () => { setTplId(""); setValues({}); setFiles({}); } });
  }

  if (!templates.length && !submissions.length) return null;
  return (
    <div className="space-y-3">
      <h2 className="font-semibold">{t("kb.forms")}</h2>
      {submissions.map((s) => (
        <a key={s.id} href={`/api/forms/${s.id}/pdf`} className="flex min-h-12 items-center gap-3 rounded-[12px] bg-card px-3 text-sm hover:bg-surface-3">
          <IconDownload className="size-4 text-link" />
          <span className="flex-1">{name(s.template_id)}</span>
          <span className="text-muted">{formatDateTime(s.created_at, locale)}</span>
        </a>
      ))}
      {canFill && templates.length > 0 && (
        <form className="space-y-3 rounded-[14px] bg-card p-3" onSubmit={submit}>
          <Field label={t("kb.fill")}>
            <Select value={tplId} onChange={(e) => { setTplId(e.target.value); setValues({}); }}>
              <option value="">—</option>
              {templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Field>
          {tpl?.fields.map((f) =>
            f.type === "checkbox" ? (
              <label key={f.id} className="flex min-h-12 items-center gap-3">
                <input type="checkbox" className="size-5" checked={Boolean(values[f.id])} onChange={(e) => setValues({ ...values, [f.id]: e.target.checked })} />
                {f.label}
              </label>
            ) : f.type === "select" ? (
              <Field key={f.id} label={f.label}>
                <Select value={String(values[f.id] ?? "")} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}>
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              </Field>
            ) : f.type === "photo" ? (
              isDemo() ? null : (
                <Field key={f.id} label={f.label}>
                  <input type="file" accept="image/*" capture="environment" className="block w-full text-sm" onChange={(e) => setFiles({ ...files, [f.id]: e.target.files?.[0] ?? null })} />
                </Field>
              )
            ) : (
              <Field key={f.id} label={f.label}>
                <Input inputMode={f.type === "number" ? "decimal" : undefined} type={f.type === "number" ? "number" : "text"} step="any" maxLength={2000}
                  value={String(values[f.id] ?? "")} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} />
              </Field>
            ),
          )}
          <ErrorText error={error} />
          {tpl && <button className="btn-primary w-full sm:w-auto" disabled={pending}>{t("kb.submitForm")}</button>}
        </form>
      )}
    </div>
  );
}

export function ArticlePicker({ taskId, value, articles }: { taskId: string; value: string | null; articles: { id: string; title: string }[] }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  if (!articles.length) return null;
  return (
    <Field label={t("kb.linked")}>
      <Select disabled={pending} value={value ?? ""} onChange={(e) => run(() => setTaskArticle(taskId, e.target.value || null))}>
        <option value="">—</option>
        {articles.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
      </Select>
      <ErrorText error={error} />
    </Field>
  );
}
