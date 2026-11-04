"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { acceptTask, returnTask } from "@/server/actions/tasks";
import { formatDateTime } from "@/lib/dates";
import { useAction, ErrorText } from "../use-action";
import { IconCheck } from "../icons";
import { cx } from "../ui";

/** Chef: "Wartet auf Ihre Prüfung" – abnehmen (mit Bewertung) oder zur Nacharbeit zurück. */
export function ReviewPanel({ taskId, submittedAt, status }: { taskId: string; submittedAt: string | null; status: string }) {
  const { t, locale } = useI18n();
  const { run, pending, error, setError } = useAction();
  const [rating, setRating] = useState<number | null>(null);
  const [mode, setMode] = useState<"idle" | "return">("idle");
  const [comment, setComment] = useState("");

  return (
    <div className={cx("space-y-3 rounded-[16px] p-4", status === "review" ? "bg-review-soft" : "bg-card")}>
      {status === "review" && (
        <div>
          <div className="font-semibold text-review">{t("task.reviewBanner")}</div>
          {submittedAt && <div className="text-sm text-ink-2">{t("task.reviewSince", { time: formatDateTime(submittedAt, locale) })}</div>}
        </div>
      )}
      {mode === "return" ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (comment.trim().length < 3) return setError(t("task.returnCommentRequired"));
            run(() => returnTask(taskId, comment), { onOk: () => { setMode("idle"); setComment(""); } });
          }}
        >
          <textarea
            className="input min-h-24 py-3"
            autoFocus
            required
            minLength={3}
            maxLength={4000}
            placeholder={t("task.returnComment")}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button className="btn-danger" disabled={pending}>{t("task.returnSend")}</button>
            <button type="button" className="btn-ghost" onClick={() => setMode("idle")}>{t("common.cancel")}</button>
          </div>
        </form>
      ) : (
        <>
          {status === "review" && (
            <div>
              <div className="mb-1 text-sm text-ink-2">{t("task.rating")}</div>
              <div className="flex gap-1" role="radiogroup" aria-label={t("task.rating")}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n}/5`}
                    onClick={() => setRating(rating === n ? null : n)}
                    className="flex size-11 items-center justify-center rounded-[12px] hover:bg-white/5"
                  >
                    <Star strokeWidth={1.8} className={cx("size-6", rating !== null && n <= rating ? "fill-review text-review" : "text-muted")} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => setMode("return")}>
              {t("task.returnRework")}
            </button>
            {status === "review" && (
              <button type="button" className="btn-primary flex-1 sm:flex-none" disabled={pending} onClick={() => run(() => acceptTask(taskId, rating))}>
                <IconCheck className="size-5" />
                {t("task.accept")}
              </button>
            )}
          </div>
        </>
      )}
      <ErrorText error={error} />
    </div>
  );
}
