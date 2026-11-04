"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { addAdjustment, decideExpense } from "@/server/actions/money";
import { todayISO } from "@/lib/dates";
import { useAction, ErrorText } from "../use-action";
import { Field, Input, Select, cx } from "../ui";

export function AdjustForm({ members }: { members: { id: string; full_name: string }[] }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const empty = { memberId: members[0]?.id ?? "", amount: "", negative: false, reason: "", date: todayISO() };
  const [v, setV] = useState(empty);
  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => { e.preventDefault(); run(() => addAdjustment(v), { onOk: () => setV({ ...empty, memberId: v.memberId }) }); }}>
      <Field label={t("export.employee")}>
        <Select value={v.memberId} onChange={(e) => setV({ ...v, memberId: e.target.value })}>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</Select>
      </Field>
      <div>
        <span className="label">&nbsp;</span>
        <div className="grid grid-cols-2 gap-1 rounded-[13px] bg-card p-1">
          {[false, true].map((neg) => (
            <button key={String(neg)} type="button" onClick={() => setV({ ...v, negative: neg })} className={cx("min-h-10 rounded-[10px] text-sm", v.negative === neg ? (neg ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok") : "text-muted")}>
              {neg ? t("adjust.deduction") : t("adjust.bonus")}
            </button>
          ))}
        </div>
      </div>
      <Field label={t("expense.amount")}><Input inputMode="decimal" required value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
      <Field label={t("adjust.date")}><Input type="date" required value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
      <Field label={t("adjust.reason")}><Input required minLength={3} maxLength={300} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></Field>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
        <button className="btn-primary" disabled={pending}>{t("adjust.add")}</button>
        <ErrorText error={error} />
      </div>
    </form>
  );
}

export function ExpenseDecision({ id }: { id: string }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <div className="flex gap-1.5">
      <button className="btn-primary !min-h-9 !px-3 text-sm" disabled={pending} onClick={() => run(() => decideExpense(id, true))}>{t("expense.approve")}</button>
      <button className="btn-secondary !min-h-9 !px-3 text-sm" disabled={pending} onClick={() => run(() => decideExpense(id, false))}>{t("expense.reject")}</button>
    </div>
  );
}
