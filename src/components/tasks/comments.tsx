"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { addComment, deleteComment } from "@/server/actions/tasks";
import { formatDateTime } from "@/lib/dates";
import { useAction, ErrorText } from "../use-action";
import { Avatar } from "../ui";

export function Comments({
  taskId, comments, myMemberId, isBoss,
}: { taskId: string; comments: { id: string; author_id: string | null; author_name: string; body: string; created_at: string }[]; myMemberId: string; isBoss: boolean }) {
  const { t, locale } = useI18n();
  const { run, pending, error } = useAction();
  const [body, setBody] = useState("");
  return (
    <div>
      <h2 className="mb-2 font-semibold">{t("task.comments")}</h2>
      {comments.length === 0 && <p className="mb-2 text-sm text-muted">{t("task.noComments")}</p>}
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-2">
            <Avatar name={c.author_name} />
            <div className="min-w-0 flex-1 rounded-[14px] bg-card px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                <span className="font-medium text-ink">{c.author_name}</span>
                <span>{formatDateTime(c.created_at, locale)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
              {(isBoss || c.author_id === myMemberId) && (
                <button className="mt-1 text-xs text-muted hover:text-danger" onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteComment(c.id))}>
                  {t("common.delete")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          run(() => addComment(taskId, body), { onOk: () => setBody("") });
        }}
      >
        <textarea className="input min-h-12 flex-1 py-3" rows={1} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("task.commentPlaceholder")} />
        <button className="btn-primary" disabled={pending}>{t("task.send")}</button>
      </form>
      <ErrorText error={error} />
    </div>
  );
}
