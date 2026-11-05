"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/config";
import { setTaskLocation } from "@/server/actions/geo";
import { formatDateTime } from "@/lib/dates";
import type { MapPoint } from "./map";

const GeoMap = dynamic(() => import("./map").then((m) => m.GeoMap), { ssr: false, loading: () => <div className="skeleton h-64" /> });

/** Karte in der Aufgabe: Objekt + Standortpunkte (Begonnen/Fertig); Chef kann Objekt setzen */
export function TaskMap({ taskId, object, points, editable }: { taskId: string; object: { lat: number; lng: number } | null; points: { lat: number; lng: number; kind: string; created_at: string; who: string }[]; editable: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const all: MapPoint[] = [
    ...(object ? [{ ...object, label: t("geo.setLocation"), tone: "object" as const }] : []),
    ...points.map((p) => ({ lat: p.lat, lng: p.lng, label: `${t(`geo.kind_${p.kind}` as MessageKey)} · ${p.who} · ${formatDateTime(p.created_at, locale)}`, tone: (p.kind.endsWith("start") ? "start" : "finish") as MapPoint["tone"] })),
  ];
  if (!all.length && !editable) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{t("geo.map")}</span>
        {editable && (
          <div className="flex gap-2">
            <button type="button" className={editing ? "btn-primary !min-h-9 text-sm" : "btn-secondary !min-h-9 text-sm"} onClick={() => setEditing(!editing)}>{t("geo.setLocation")}</button>
            <button
              type="button"
              className="btn-ghost !min-h-9 text-sm"
              onClick={() => navigator.geolocation?.getCurrentPosition(async (p) => { await setTaskLocation(taskId, p.coords.latitude, p.coords.longitude); router.refresh(); })}
            >
              {t("geo.myPosition")}
            </button>
          </div>
        )}
      </div>
      {editing && <p className="text-sm text-muted">{t("geo.setHint")}</p>}
      <GeoMap
        points={all}
        attribution={t("geo.attribution")}
        onPick={editing ? async (lat, lng) => { await setTaskLocation(taskId, lat, lng); setEditing(false); router.refresh(); } : undefined}
      />
      {points.length > 0 && (
        <ul className="text-xs text-muted">
          {points.map((p, i) => <li key={i}>{t(`geo.kind_${p.kind}` as MessageKey)} · {p.who} · {formatDateTime(p.created_at, locale)}</li>)}
        </ul>
      )}
    </div>
  );
}
