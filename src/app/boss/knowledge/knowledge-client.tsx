"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { deleteArticle, deleteFormTemplate, saveArticle, saveFormTemplate } from "@/server/actions/team";
import { parseFormFields } from "@/lib/form-fields";
import { Field, Input, Textarea } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import { IconTrash } from "@/components/icons";

export function ArticleForm({ article, onDone }: { article?: { id: string; title: string; body: string }; onDone?: () => void }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState({ title: article?.title ?? "", body: article?.body ?? "" });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => saveArticle(article?.id ?? null, v), { onOk: () => { if (!article) setV({ title: "", body: "" }); onDone?.(); } }); }}>
      <Field label={t("team.annTitle")}><Input required maxLength={160} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
      <Field label={t("team.body")}><Textarea maxLength={20000} rows={8} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} /></Field>
      <ErrorText error={error} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{t("common.save")}</button>
        {article && <button type="button" className="btn-ghost text-danger" disabled={pending} onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteArticle(article.id))}>{t("common.delete")}</button>}
      </div>
    </form>
  );
}

export function EditableArticle({ article }: { article: { id: string; title: string; body: string } }) {
  const { t } = useI18n();
  const [edit, setEdit] = useState(false);
  if (edit) return <div className="card-white p-4"><ArticleForm article={article} onDone={() => setEdit(false)} /></div>;
  return (
    <details className="card-white p-4">
      <summary className="cursor-pointer font-semibold">{article.title}</summary>
      <p className="mt-2 whitespace-pre-wrap text-ink-2">{article.body}</p>
      <button className="btn-secondary mt-3 !min-h-9 text-sm" onClick={() => setEdit(true)}>{t("common.edit")}</button>
    </details>
  );
}

export function FormTemplateForm() {
  const { t } = useI18n();
  const { run, pending, error, setError } = useAction();
  const [v, setV] = useState({ name: "", src: "" });
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      const { fields, errors } = parseFormFields(v.src);
      if (errors.length || !fields.length) return setError(`${t("common.invalid")} ${errors.map((n) => t("imp.row", { n })).join(", ")}`);
      run(() => saveFormTemplate({ name: v.name, fields }), { onOk: () => setV({ name: "", src: "" }) });
    }}>
      <Field label={t("clients.name")}><Input required maxLength={120} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label={t("kb.forms")} hint={t("kb.fieldsHint")}><Textarea rows={6} required value={v.src} onChange={(e) => setV({ ...v, src: e.target.value })} placeholder={"text;Bemerkung\ncheckbox;Arbeitsplatz sauber\nselect;Zustand;Gut|Mängel\nphoto;Foto nachher"} /></Field>
      <ErrorText error={error} />
      <button className="btn-primary" disabled={pending}>{t("common.save")}</button>
    </form>
  );
}

export function DeleteFormTemplate({ id }: { id: string }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <button className="btn-ghost !min-h-9 !px-2 text-muted" aria-label={t("common.delete")} disabled={pending} onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteFormTemplate(id))}>
      <IconTrash className="size-4" />
    </button>
  );
}
