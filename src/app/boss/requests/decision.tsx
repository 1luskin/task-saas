"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { approveRequest, rejectRequest } from "@/server/actions/requests";
import { Field, Input, Select } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import type { MemberOption } from "@/components/tasks/task-form";

export function RequestDecision({ id, dueDate, members }: { id: string; dueDate: string; members: MemberOption[] }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState({ assignee_id: "", due_date: dueDate, priority: "normal" as "normal" | "urgent", client_price: "", fixed_pay: "" });
  return (
    <form
      className="grid gap-3 rounded-[16px] bg-card p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => approveRequest(id, { ...v, assignee_id: v.assignee_id || null }));
      }}
    >
      <Field label={t("requests.chooseAssignee")}>
        <Select value={v.assignee_id} onChange={(e) => setV({ ...v, assignee_id: e.target.value })}>
          <option value="">{t("dashboard.unassigned")}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id} disabled={m.status !== "active"}>
              {m.full_name}{m.status !== "active" ? ` — ${t(`memberStatus.${m.status}`)}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("task.dueDate")}><Input type="date" value={v.due_date} onChange={(e) => setV({ ...v, due_date: e.target.value })} /></Field>
      <Field label={`${t("task.clientPrice")} (€)`}><Input inputMode="decimal" value={v.client_price} onChange={(e) => setV({ ...v, client_price: e.target.value })} /></Field>
      <Field label={`${t("task.fixedPay")} (€)`}><Input inputMode="decimal" value={v.fixed_pay} onChange={(e) => setV({ ...v, fixed_pay: e.target.value })} /></Field>
      <label className="flex min-h-12 items-center gap-2 sm:col-span-2">
        <input type="checkbox" className="size-5 accent-[#9e3b37]" checked={v.priority === "urgent"} onChange={(e) => setV({ ...v, priority: e.target.checked ? "urgent" : "normal" })} />
        {t("priority.urgent")}
      </label>
      <ErrorText error={error} />
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary flex-1" disabled={pending}>{t("requests.approve")}</button>
        <button type="button" className="btn-secondary flex-1" disabled={pending} onClick={() => run(() => rejectRequest(id))}>{t("requests.reject")}</button>
      </div>
    </form>
  );
}
