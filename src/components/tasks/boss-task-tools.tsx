"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { deleteTask } from "@/server/actions/tasks";
import { TaskForm, type MemberOption, type TaskFormValues } from "./task-form";
import type { TaskFields } from "@/lib/supabase/types";
import { useAction, ErrorText } from "../use-action";

export function BossTaskTools({ taskId, initial, members, fields, clients = [] }: { taskId: string; initial: TaskFormValues; members: MemberOption[]; fields?: TaskFields; clients?: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { run, pending, error } = useAction();

  if (editing) {
    return (
      <div className="card-white p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("task.editTitle")}</h2>
        <TaskForm taskId={taskId} initial={initial} members={members} fields={fields} clients={clients} onDone={() => { setEditing(false); router.refresh(); }} />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-primary flex-1 sm:flex-none" onClick={() => setEditing(true)}>{t("common.edit")}</button>
      <button
        className="btn-secondary text-danger"
        disabled={pending}
        onClick={() => {
          if (confirm(t("common.confirmDelete"))) run(() => deleteTask(taskId), { onOk: () => router.push("/boss"), refresh: false });
        }}
      >
        {t("common.delete")}
      </button>
      <ErrorText error={error} />
    </div>
  );
}
