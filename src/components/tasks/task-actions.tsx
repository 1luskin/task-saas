"use client";
import { useEffect, useState } from "react";
import { tap } from "@/lib/haptics";
import { useI18n } from "@/i18n/client";
import { enqueue, overlayTask, useQueue, uuid } from "@/lib/offline/queue";
import { formatDuration, minutesBetween } from "@/lib/dates";
import { IconCheck, IconPlay } from "../icons";
import { cx } from "../ui";

/**
 * Große Buttons "Begonnen" / "Fertig" mit Zeiterfassung.
 * Läuft komplett über die Offline-Queue.
 */
export function TaskActions({
  taskId, status, runningSince, spentMinutes, canWork, size = "xl",
}: {
  taskId: string;
  status: "new" | "in_progress" | "done";
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
      {curStatus === "done" ? (
        <button
          className={cx("btn-secondary w-full", h)}
          onClick={() => enqueue({ op: "status", taskId, status: "in_progress" })}
        >
          {t("task.reopen")}
        </button>
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
            {t("task.finish")}
          </button>
        </div>
      )}
    </div>
  );
}
