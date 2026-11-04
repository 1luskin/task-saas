"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { createRequest } from "@/server/actions/requests";
import { Field, Input, Textarea } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";

export function RequestForm() {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const empty = { title: "", description: "", address: "", due_date: "" };
  const [v, setV] = useState(empty);
  const [sent, setSent] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createRequest(v), { onOk: () => { setV(empty); setSent(true); } });
      }}
    >
      <Field label={t("task.title")}><Input required maxLength={200} value={v.title} onChange={(e) => { setV({ ...v, title: e.target.value }); setSent(false); }} /></Field>
      <Field label={t("task.description")}><Textarea maxLength={5000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("task.address")}><Input maxLength={300} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
        <Field label={t("task.dueDate")}><Input type="date" value={v.due_date} onChange={(e) => setV({ ...v, due_date: e.target.value })} /></Field>
      </div>
      <ErrorText error={error} />
      <button className="btn-primary btn-xl w-full" disabled={pending}>{sent ? t("requests.sent") : t("requests.submit")}</button>
    </form>
  );
}
