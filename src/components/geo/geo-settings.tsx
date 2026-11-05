"use client";
import { useI18n } from "@/i18n/client";
import { setGeoSettings } from "@/server/actions/geo";
import { recordConsent } from "@/server/actions/consent";
import { useAction } from "../use-action";
import { Select } from "../ui";
import { useState } from "react";

export function GeoSettings({ radius, retention }: { radius: number | null; retention: number }) {
  const { t } = useI18n();
  const { run } = useAction();
  const [r, setR] = useState(radius);
  const [d, setD] = useState(retention);
  const save = (nr: number | null, nd: number) => run(() => setGeoSettings({ radius: nr, retentionDays: nd }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{t("geo.geofence")}</span>
        <Select className="!w-auto" value={r ?? ""} aria-label={t("geo.geofence")} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; setR(v); save(v, d); }}>
          <option value="">{t("geo.geofenceOff")}</option>
          {[100, 200, 500, 1000].map((m) => <option key={m} value={m}>{m} m</option>)}
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{t("geo.retention")}</span>
        <Select className="!w-auto" value={d} aria-label={t("geo.retention")} onChange={(e) => { const v = Number(e.target.value); setD(v); save(r, v); }}>
          {[30, 60, 90, 180].map((x) => <option key={x} value={x}>{x} d</option>)}
        </Select>
      </div>
    </div>
  );
}

export function RevokeGeoConsent() {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  if (done) return null;
  return <button className="btn-ghost w-full text-sm text-muted" onClick={async () => { await recordConsent("geolocation", false); setDone(true); }}>{t("geo.revoke")}</button>;
}
