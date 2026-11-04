"use client";
import type { TaskStatus } from "@/lib/supabase/types";
import { useEffect, useState } from "react";
import { tap } from "@/lib/haptics";
import { useI18n } from "@/i18n/client";
import { enqueue, overlayTask, useQueue, uuid } from "@/lib/offline/queue";
import { formatDuration, minutesBetween } from "@/lib/dates";
import { IconCheck, IconClock, IconPlay } from "../icons";
import { cx } from "../ui";

/**
 * Große Buttons "Begonnen" / "Fertig" mit Zeiterfassung.
 * Läuft komplett über die Offline-Queue.
 */
export function TaskActions({
  taskId, status, runningSince, spentMinutes, canWork, size = "xl",
}: {
  taskId: string;
  status: TaskStatus;
  runningSince: string | null; // laufender Zeiteintrag (Server)
  spentMinutes: number; // abgeschlossene Minuten (Server)
  canWork: boolean;
  size?: "xl" | "md";
}) {
  const { t } = useI18n();
  const queue = useQueue();
  const ov = overlayTask({ id: taskId, status }, queue, runningSince);
  const running = ov.running;
  const curStatus = ov.status;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(iv);
  }, [running]);

  const total = spentMinutes + ov.extraMinutes + (running ? minutesBetween(running, null, now) : 0);
  const h = size === "xl" ? "btn-xl" : "";

  if (!canWork) return null;
  return (
    <div className="space-y-2">
      {(total > 0 || running) && (
        <div className={cx("flex items-center gap-2 text-sm", running ? "text-link" : "text-muted")}>
          {running && <span className="size-2 animate-pulse rounded-full bg-accent" />}
          {t("task.timeSpent")}: <span className="font-semibold tabular-nums">{formatDuration(total)}</span>
        </div>
      )}
      {curStatus === "done" ? null : curStatus === "review" ? (
        <div className="flex min-h-[52px] items-center gap-2 rounded-[14px] bg-review-soft px-4 text-review">
          <IconClock className="size-5" />
          {t("task.waitingReview")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            className={cx(running ? "btn-secondary" : "btn-primary", h)}
            disabled={Boolean(running)}
            onClick={() => { tap(); enqueue({ op: "start", taskId, entryId: uuid() }); }}
          >
            <IconPlay className="size-6" />
            {t("task.start")}
          </button>
          <button
            className={cx(running ? "btn-primary" : "btn-secondary", h)}
            onClick={() => { tap(); enqueue({ op: "finish", taskId }); }}
          >
            <IconCheck className="size-6" />
            <span className="leading-tight">{size === "xl" ? t("task.finish") : t("task.finishReview")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
