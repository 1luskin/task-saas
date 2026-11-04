"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { applyChecklistTemplate, deleteChecklistTemplate, saveChecklistTemplate } from "@/server/actions/views";
import { useAction, ErrorText } from "../use-action";
import { Field, Input, Select, Textarea } from "../ui";
import { IconTrash } from "../icons";

export function ChecklistTemplatesManager({ templates }: { templates: { id: string; name: string; items: string[] }[] }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState({ name: "", items: "" });
  return (
    <div className="space-y-3">
      <h2 className="font-semibold">{t("views.checklistTpl")}</h2>
      <ul className="space-y-1.5">
        {templates.map((tpl) => (
          <li key={tpl.id} className="flex items-center gap-2 rounded-[12px] bg-card px-3 py-2 text-sm">
            <span className="font-medium">{tpl.name}</span>
            <span className="min-w-0 flex-1 truncate text-muted">{tpl.items.join(" · ")}</span>
            <button className="btn-ghost !min-h-9 !px-2 text-muted" aria-label={t("common.delete")} onClick={() => run(() => deleteChecklistTemplate(tpl.id))}><IconTrash className="size-4" /></button>
          </li>
        ))}
      </ul>
      <form className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]" onSubmit={(e) => { e.preventDefault(); run(() => saveChecklistTemplate(v), { onOk: () => setV({ name: "", items: "" }) }); }}>
        <Field label={t("views.tplName")}><Input required maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label={t("views.tplItems")}><Textarea rows={2} className="!min-h-12" value={v.items} onChange={(e) => setV({ ...v, items: e.target.value })} /></Field>
        <div className="flex items-end"><button className="btn-primary" disabled={pending}>+</button></div>
      </form>
      <ErrorText error={error} />
    </div>
  );
}

export function ApplyChecklistTemplate({ taskId, templates }: { taskId: string; templates: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  if (!templates.length) return null;
  return (
    <Select className="!min-h-10 !w-auto text-sm" defaultValue="" disabled={pending} aria-label={t("views.applyTpl")} onChange={(e) => { if (e.target.value) run(() => applyChecklistTemplate(taskId, e.target.value)); e.target.value = ""; }}>
      <option value="" disabled>{t("views.applyTpl")}</option>
      {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
    </Select>
  );
}
