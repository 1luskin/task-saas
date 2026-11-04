"use client";
import { useState } from "react";
import { tap } from "@/lib/haptics";
import { useI18n } from "@/i18n/client";
import { enqueue, overlayTask, useQueue } from "@/lib/offline/queue";
import { addChecklistItem, deleteChecklistItem } from "@/server/actions/tasks";
import { useAction } from "../use-action";
import { IconCheck, IconTrash } from "../icons";
import { cx } from "../ui";

export function Checklist({
  taskId, status, items, editable,
}: { taskId: string; status: "new" | "in_progress" | "done"; items: { id: string; text: string; done: boolean }[]; editable: boolean }) {
  const { t } = useI18n();
  const queue = useQueue();
  const ov = overlayTask({ id: taskId, status }, queue);
  const { run, pending } = useAction();
  const [text, setText] = useState("");
  const doneCount = items.filter((i) => ov.checklist.get(i.id) ?? i.done).length;

  if (!items.length && !editable) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">{t("task.checklist")}</h2>
        {items.length > 0 && <span className="text-sm text-muted">{t("task.progress", { done: doneCount, total: items.length })}</span>}
      </div>
      <ul className="space-y-1.5">
        {items.map((i) => {
          const done = ov.checklist.get(i.id) ?? i.done;
          return (
            <li key={i.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { tap(); enqueue({ op: "checklist", taskId, itemId: i.id, done: !done }); }}
                className={cx(
                  "flex min-h-14 flex-1 items-center gap-3 rounded-[14px] border px-3 text-left transition lg:min-h-11",
                  done ? "border-ok/30 bg-ok-soft" : "border-line bg-surface",
                )}
              >
                <span className={cx("flex size-7 shrink-0 items-center justify-center rounded-[8px] border-2", done ? "border-ok bg-ok text-bg" : "border-line")}>
                  {done && <IconCheck className="check-pop size-5" />}
                </span>
                <span className={cx(done && "text-muted line-through")}>{i.text}</span>
              </button>
              {editable && (
                <button type="button" className="btn-ghost !px-3 text-muted" onClick={() => run(() => deleteChecklistItem(i.id))} aria-label={t("common.delete")}>
                  <IconTrash className="size-5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {editable && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            run(() => addChecklistItem(taskId, text), { onOk: () => setText("") });
          }}
        >
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("task.addItem")} maxLength={300} />
          <button className="btn-secondary" disabled={pending}>+</button>
        </form>
      )}
    </div>
  );
}
