"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { enqueue, useQueue, uuid } from "@/lib/offline/queue";
import { formatDateTime, formatDuration } from "@/lib/dates";
import { shiftNetMinutes } from "@/lib/shifts";
import { tap } from "@/lib/haptics";
import { useGeo } from "../geo/geo-context";
import { withinGeofence } from "@/lib/geo";
import type { Shift } from "@/lib/supabase/types";
import { IconPause, IconPlay, IconStop } from "../icons";
import { cx } from "../ui";

type S = Pick<Shift, "id" | "started_at" | "ended_at" | "break_minutes" | "break_started_at">;

/** Server-Zustand + noch nicht synchronisierte Schicht-Aktionen */
function overlay(server: S | null, queue: ReturnType<typeof useQueue>): S | null {
  let s = server ? { ...server } : null;
  for (const o of queue) {
    if (o.op === "shift_start") s = { id: o.shiftId, started_at: o.at, ended_at: null, break_minutes: 0, break_started_at: null };
    else if (!s || !("shiftId" in o) || o.shiftId !== s.id) continue;
    else if (o.op === "shift_pause" && !s.break_started_at) s.break_started_at = o.at;
    else if (o.op === "shift_resume" && s.break_started_at) {
      s.break_minutes += Math.max(0, (new Date(o.at).getTime() - new Date(s.break_started_at).getTime()) / 60000);
      s.break_started_at = null;
    } else if (o.op === "shift_end") s = null;
  }
  return s;
}

export function ShiftCard({ open, geofence }: { open: S | null; geofence?: { radius: number; targets: { lat: number | null; lng: number | null }[] } | null }) {
  const { t, locale } = useI18n();
  const geo = useGeo();
  const [geoError, setGeoError] = useState<string | null>(null);
  const queue = useQueue();
  const s = overlay(open, queue);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!s) return;
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, [s]);

  if (!s) {
    return (
      <div className="space-y-2">
        <button
          className="btn-primary btn-xl w-full"
          onClick={async () => {
            tap();
            setGeoError(null);
            const fix = (await geo.capture()) ?? undefined;
            // Geozone vorab prüfen (der Server prüft zusätzlich)
            if (geo.enabled && geofence && geofence.targets.some((x) => x.lat != null)) {
              if (!fix) return setGeoError(t("geo.needLocation"));
              if (!withinGeofence(fix, geofence.targets, geofence.radius)) return setGeoError(t("geo.outside"));
            }
            enqueue({ op: "shift_start", shiftId: uuid(), geo: fix });
          }}
        >
          <IconPlay className="size-6" />
          {t("shift.start")}
        </button>
        {geoError && <p className="text-sm text-danger" role="alert">{geoError}</p>}
      </div>
    );
  }
  const paused = Boolean(s.break_started_at);
  return (
    <div className={cx("card-white space-y-3 p-4", paused ? "ring-1 ring-review/40" : "ring-1 ring-accent-2/40")}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-muted">{paused ? t("shift.paused", { time: formatDateTime(s.break_started_at!, locale) }) : t("shift.running", { time: formatDateTime(s.started_at, locale) })}</div>
          <div className="font-display text-3xl font-semibold tabular-nums">{formatDuration(shiftNetMinutes(s, now))}</div>
        </div>
        <span className={cx("size-3 rounded-full", paused ? "bg-review" : "animate-pulse bg-accent-2")} aria-hidden />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary btn-xl" onClick={() => { tap(); enqueue({ op: paused ? "shift_resume" : "shift_pause", shiftId: s.id }); }}>
          {paused ? <IconPlay className="size-6" /> : <IconPause className="size-6" />}
          {paused ? t("shift.resume") : t("shift.pause")}
        </button>
        <button className="btn-danger btn-xl" onClick={async () => { if (confirm(t("shift.endConfirm"))) { tap(); enqueue({ op: "shift_end", shiftId: s.id, geo: (await geo.capture()) ?? undefined }); } }}>
          <IconStop className="size-5" />
          {t("shift.end")}
        </button>
      </div>
    </div>
  );
}
