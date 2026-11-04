"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { removeMember, updateMember } from "@/server/actions/members";
import { centsToInput, formatMoney } from "@/lib/money";
import type { Member } from "@/lib/supabase/types";
import { Avatar, Field, Input, Select, cx } from "../ui";
import { useAction, ErrorText } from "../use-action";

export function MemberCard({ member: m, groups, isSelf, tasksDoneMonth, reworksMonth = 0, avgRating = null }: { member: Member; groups: { id: string; name: string }[]; isSelf: boolean; tasksDoneMonth: number; reworksMonth?: number; avgRating?: number | null }) {
  const { t, locale } = useI18n();
  const { run, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    full_name: m.full_name,
    phone: m.phone ?? "",
    role: m.role,
    group_id: m.group_id ?? "",
    status: m.status,
    pay_mode: m.pay_mode,
    hourly_rate: centsToInput(m.hourly_rate_cents),
  });
  const unavailable = m.status !== "active";
  const group = groups.find((g) => g.id === m.group_id);

  return (
    <div className={cx("card-white overflow-hidden", unavailable && "border-danger/30")}>
      <button className="flex min-h-16 w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(!open)}>
        <Avatar name={m.full_name} className="size-10 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{m.full_name}</span>
            {m.role === "boss" && <span className="chip bg-accent-soft text-link">{t("role.boss")}</span>}
            {unavailable && <span className="chip bg-danger-soft text-danger">{t(`memberStatus.${m.status}`)}</span>}
            {group && <span className="chip bg-card text-muted">{group.name}</span>}
          </div>
          <div className="mt-0.5 truncate text-sm text-muted">
            {t(`payMode.${m.pay_mode}`)}
            {m.pay_mode !== "fixed" && ` · ${formatMoney(m.hourly_rate_cents, locale)}/h`}
            {m.email && ` · ${m.email}`}
          </div>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-lg font-semibold tabular-nums">{tasksDoneMonth}</div>
            <div className="text-xs text-muted">{t("employees.tasksDone")}</div>
          </div>
          <div className="hidden sm:block">
            <div className="text-lg font-semibold tabular-nums">{reworksMonth}</div>
            <div className="text-xs text-muted">{t("employees.reworks")}</div>
          </div>
          <div className="hidden sm:block">
            <div className="text-lg font-semibold tabular-nums">{avgRating ? avgRating.toFixed(1) : "—"}</div>
            <div className="text-xs text-muted">{t("employees.avgRating")}</div>
          </div>
        </div>
      </button>
      {open && (
        <form
          className="grid gap-3 border-t border-line/70 bg-card/50 p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateMember(m.id, { ...v, group_id: v.group_id || null }), { onOk: () => setOpen(false) });
          }}
        >
          <Field label={t("employees.name")}><Input value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} required /></Field>
          <Field label={t("employees.phone")}><Input type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          <Field label={t("employees.status")}>
            <Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Member["status"] })}>
              {(["active", "vacation", "sick"] as const).map((s) => <option key={s} value={s}>{t(`memberStatus.${s}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("employees.role")}>
            <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Member["role"] })}>
              <option value="employee">{t("role.employee")}</option>
              <option value="boss">{t("role.boss")}</option>
            </Select>
          </Field>
          <Field label={t("employees.payMode")}>
            <Select value={v.pay_mode} onChange={(e) => setV({ ...v, pay_mode: e.target.value as Member["pay_mode"] })}>
              {(["hourly", "fixed", "both"] as const).map((p) => <option key={p} value={p}>{t(`payMode.${p}`)}</option>)}
            </Select>
          </Field>
          {v.pay_mode !== "fixed" && (
            <Field label={t("employees.rate")}><Input inputMode="decimal" value={v.hourly_rate} onChange={(e) => setV({ ...v, hourly_rate: e.target.value })} placeholder="15,00" /></Field>
          )}
          <Field label={t("employees.group")}>
            <Select value={v.group_id} onChange={(e) => setV({ ...v, group_id: e.target.value })}>
              <option value="">{t("employees.noGroup")}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
            <button className="btn-primary" disabled={pending}>{t("common.save")}</button>
            {!isSelf && (
              <button type="button" className="btn-secondary text-danger" disabled={pending} onClick={() => confirm(t("employees.removeConfirm")) && run(() => removeMember(m.id))}>
                {t("employees.remove")}
              </button>
            )}
            <ErrorText error={error} />
          </div>
        </form>
      )}
    </div>
  );
}
