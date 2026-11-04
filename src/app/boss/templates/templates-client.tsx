"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { deleteTemplate, saveTemplate, setTemplateActive } from "@/server/actions/templates";
import { centsToInput, formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { TaskTemplate } from "@/lib/supabase/types";
import { Field, Input, Select, Textarea, cx } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import { IconPlus } from "@/components/icons";

type M = { id: string; full_name: string; status: string };

function TemplateForm({ tpl, members, onDone }: { tpl: TaskTemplate | null; members: M[]; onDone: () => void }) {
  const { t, messages } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState({
    title: tpl?.title ?? "",
    description: tpl?.description ?? "",
    address: tpl?.address ?? "",
    assignee_id: tpl?.assignee_id ?? "",
    priority: tpl?.priority ?? "normal",
    recurrence: tpl?.recurrence ?? "weekly",
    weekdays: tpl?.weekdays ?? [1],
    month_day: tpl?.month_day ?? 1,
    client_price: centsToInput(tpl?.client_price_cents),
    fixed_pay: centsToInput(tpl?.fixed_pay_cents),
    checklist: (tpl?.checklist ?? []).join("\n"),
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            saveTemplate(tpl?.id ?? null, {
              ...v,
              assignee_id: v.assignee_id || null,
              month_day: v.recurrence === "monthly" ? Number(v.month_day) : null,
              checklist: v.checklist.split("\n").map((s) => s.trim()).filter(Boolean),
              active: tpl?.active ?? true,
            }),
          { onOk: onDone },
        );
      }}
    >
      <Field label={t("task.title")}><Input required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={200} /></Field>
      <Field label={t("task.description")}><Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("task.assignee")}>
          <Select value={v.assignee_id} onChange={(e) => setV({ ...v, assignee_id: e.target.value })}>
            <option value="">{t("dashboard.unassigned")}</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </Select>
        </Field>
        <Field label={t("task.priority")}>
          <Select value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value as "normal" | "urgent" })}>
            <option value="normal">{t("priority.normal")}</option>
            <option value="urgent">{t("priority.urgent")}</option>
          </Select>
        </Field>
        <Field label={t("templates.recurrence")}>
          <Select value={v.recurrence} onChange={(e) => setV({ ...v, recurrence: e.target.value as TaskTemplate["recurrence"] })}>
            {(["daily", "weekly", "monthly"] as const).map((r) => <option key={r} value={r}>{t(`recurrence.${r}`)}</option>)}
          </Select>
        </Field>
        {v.recurrence === "monthly" && (
          <Field label={t("templates.monthDay")}>
            <Input type="number" min={1} max={31} value={v.month_day} onChange={(e) => setV({ ...v, month_day: Number(e.target.value) })} />
          </Field>
        )}
      </div>
      {v.recurrence === "weekly" && (
        <div>
          <span className="label">{t("templates.weekdays")}</span>
          <div className="grid grid-cols-7 gap-1.5">
            {messages.weekdaysShort.map((d, i) => {
              const n = i + 1;
              const on = v.weekdays.includes(n);
              return (
                <button key={d} type="button" onClick={() => setV({ ...v, weekdays: on ? v.weekdays.filter((x) => x !== n) : [...v.weekdays, n] })}
                  className={cx("btn !px-0 border", on ? "border-accent bg-accent text-white" : "border-line bg-surface")}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`${t("task.clientPrice")} (€)`}><Input inputMode="decimal" value={v.client_price} onChange={(e) => setV({ ...v, client_price: e.target.value })} /></Field>
        <Field label={`${t("task.fixedPay")} (€)`}><Input inputMode="decimal" value={v.fixed_pay} onChange={(e) => setV({ ...v, fixed_pay: e.target.value })} /></Field>
      </div>
      <Field label={t("task.address")}><Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
      <Field label={t("task.checklist")} hint={t("task.checklistHint")}><Textarea value={v.checklist} onChange={(e) => setV({ ...v, checklist: e.target.value })} /></Field>
      <ErrorText error={error} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{t("common.save")}</button>
        <button type="button" className="btn-secondary" onClick={onDone}>{t("common.cancel")}</button>
      </div>
    </form>
  );
}

export function TemplatesClient({ templates, members }: { templates: TaskTemplate[]; members: M[] }) {
  const { t, messages, locale } = useI18n();
  const { run } = useAction();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const name = (id: string | null) => members.find((m) => m.id === id)?.full_name ?? t("dashboard.unassigned");
  const schedule = (tpl: TaskTemplate) =>
    tpl.recurrence === "weekly"
      ? `${t("recurrence.weekly")}: ${tpl.weekdays.map((d) => messages.weekdaysShort[d - 1]).join(", ")}`
      : tpl.recurrence === "monthly"
        ? `${t("recurrence.monthly")}: ${tpl.month_day}.`
        : t("recurrence.daily");

  return (
    <div className="space-y-3">
      {editing === "new" ? (
        <div className="card-white p-4"><TemplateForm tpl={null} members={members} onDone={() => setEditing(null)} /></div>
      ) : (
        <button className="btn-primary" onClick={() => setEditing("new")}><IconPlus className="size-5" />{t("templates.new")}</button>
      )}
      {templates.length === 0 && editing !== "new" && <p className="text-muted">{t("templates.none")}</p>}
      {templates.map((tpl) =>
        editing === tpl.id ? (
          <div key={tpl.id} className="card-white p-4"><TemplateForm tpl={tpl} members={members} onDone={() => setEditing(null)} /></div>
        ) : (
          <div key={tpl.id} className={cx("card-white p-4", !tpl.active && "opacity-60")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {tpl.title}
                  {tpl.priority === "urgent" && <span className="chip bg-danger-soft text-danger">!</span>}
                </div>
                <div className="text-sm text-muted">{schedule(tpl)} · {name(tpl.assignee_id)}</div>
                <div className="text-sm text-muted">
                  {tpl.client_price_cents != null && `${t("task.clientPrice")}: ${formatMoney(tpl.client_price_cents, locale)} · `}
                  {t("templates.lastRun")}: {tpl.last_run_on ? formatDate(tpl.last_run_on, locale) : "—"}
                </div>
              </div>
              <div className="flex gap-1">
                <button className="btn-secondary !min-h-10 text-sm" onClick={() => run(() => setTemplateActive(tpl.id, !tpl.active))}>
                  {tpl.active ? t("templates.active") : t("templates.paused")}
                </button>
                <button className="btn-secondary !min-h-10 text-sm" onClick={() => setEditing(tpl.id)}>{t("common.edit")}</button>
                <button className="btn-ghost !min-h-10 text-sm text-danger" onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteTemplate(tpl.id))}>{t("common.delete")}</button>
              </div>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
