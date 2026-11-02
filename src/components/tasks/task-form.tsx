"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Field, Input, Select, Textarea, cx } from "../ui";
import { ErrorText, useAction } from "../use-action";
import { createTask, updateTask, type TaskInput } from "@/server/actions/tasks";
import type { MemberStatus, PayMode, TaskStatus } from "@/lib/supabase/types";
import type { TaskFormValues } from "./task-form-values";
export type { TaskFormValues } from "./task-form-values";

export interface MemberOption {
  id: string;
  full_name: string;
  status: MemberStatus;
  pay_mode: PayMode;
}


export function TaskForm({
  taskId, initial, members, onDone,
}: { taskId?: string; initial: TaskFormValues; members: MemberOption[]; onDone?: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [v, setV] = useState(initial);
  const [moreOpen, setMoreOpen] = useState(Boolean(initial.address));
  const set = <K extends keyof TaskFormValues>(k: K, val: TaskFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const assignee = members.find((m) => m.id === v.assignee_id);
  const showFixed = !assignee || assignee.pay_mode !== "hourly";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: TaskInput = {
      title: v.title,
      description: v.description,
      address: v.address,
      assignee_id: v.assignee_id || null,
      due_date: v.due_date,
      due_time: v.due_time,
      priority: v.priority,
      status: v.status,
      client_price: v.client_price,
      fixed_pay: showFixed ? v.fixed_pay : "",
      checklist: taskId ? [] : v.checklist.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    run(() => (taskId ? updateTask(taskId, payload) : createTask(payload)), {
      onOk: (r) => {
        if (onDone) onDone();
        else router.push(`/boss/tasks/${(r.data as { id: string }).id}`);
      },
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("task.title")}>
        <Input required maxLength={200} value={v.title} onChange={(e) => set("title", e.target.value)} autoFocus={!taskId} />
      </Field>
      <Field label={t("task.description")}>
        <Textarea maxLength={5000} value={v.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("task.assignee")}>
          <Select value={v.assignee_id} onChange={(e) => set("assignee_id", e.target.value)}>
            <option value="">{t("dashboard.unassigned")}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id} disabled={m.status !== "active" && m.id !== initial.assignee_id}>
                {m.full_name}
                {m.status !== "active" ? ` — ${t(`memberStatus.${m.status}`)}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <span className="label">{t("task.priority")}</span>
          <div className="grid grid-cols-2 gap-2">
            {(["normal", "urgent"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set("priority", p)}
                className={cx("btn border", v.priority === p ? (p === "urgent" ? "border-danger bg-danger text-white" : "border-accent bg-accent text-white") : "border-line bg-surface")}
              >
                {t(`priority.${p}`)}
              </button>
            ))}
          </div>
        </div>
        <Field label={t("task.dueDate")}>
          <Input type="date" value={v.due_date} onChange={(e) => set("due_date", e.target.value)} />
        </Field>
        <Field label={`${t("task.dueTime")} (${t("common.optional")})`}>
          <Input type="time" value={v.due_time} onChange={(e) => set("due_time", e.target.value)} />
        </Field>
        {taskId && (
          <Field label={t("task.status")}>
            <Select value={v.status} onChange={(e) => set("status", e.target.value as TaskStatus)}>
              {(["new", "in_progress", "done"] as const).map((s) => (
                <option key={s} value={s}>{t(`status.${s}`)}</option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {!taskId && (
        <Field label={t("task.checklist")} hint={t("task.checklistHint")}>
          <Textarea value={v.checklist} onChange={(e) => set("checklist", e.target.value)} rows={3} />
        </Field>
      )}

      <div className="rounded-[16px] border border-line/70 bg-card p-4">
        <div className="mb-3 text-sm font-semibold text-muted">{t("task.finance")}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t("task.clientPrice")} (€)`}>
            <Input inputMode="decimal" placeholder="0,00" value={v.client_price} onChange={(e) => set("client_price", e.target.value)} />
          </Field>
          {showFixed && (
            <Field label={`${t("task.fixedPay")} (€)`}>
              <Input inputMode="decimal" placeholder="0,00" value={v.fixed_pay} onChange={(e) => set("fixed_pay", e.target.value)} />
            </Field>
          )}
        </div>
      </div>

      <details open={moreOpen} onToggle={(e) => setMoreOpen((e.target as HTMLDetailsElement).open)} className="rounded-[16px] border border-line/70 bg-surface">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium">{t("task.more")}</summary>
        <div className="space-y-4 px-4 pb-4">
          <Field label={t("task.address")}>
            <Input maxLength={300} autoComplete="street-address" value={v.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>
      </details>

      <ErrorText error={error} />
      <div className="flex gap-2">
        <button className="btn-primary btn-xl flex-1 sm:flex-none" disabled={pending}>
          {pending ? t("common.loading") : taskId ? t("common.save") : t("common.create")}
        </button>
        {onDone && (
          <button type="button" className="btn-secondary btn-xl" onClick={onDone}>
            {t("common.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}

