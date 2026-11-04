"use client";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { removeLogo, setMyFirmFeature, setShiftAutoclose, setTaskFields, uploadLogo } from "@/server/actions/settings";
import type { TaskFields } from "@/lib/supabase/types";
import type { MessageKey } from "@/i18n/config";
import { useAction, ErrorText } from "../use-action";
import { Select, cx } from "../ui";

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx("relative h-8 w-[52px] shrink-0 rounded-full transition disabled:opacity-50", on ? "bg-accent" : "bg-surface-3")}
    >
      <span className={cx("absolute top-1 size-6 rounded-full bg-white transition-all", on ? "left-[24px]" : "left-1")} />
    </button>
  );
}

export function LogoForm({ url }: { url: string | null }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <h2 className="font-semibold">{t("settings2.logo")}</h2>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-16 items-center justify-center overflow-hidden rounded-[14px] bg-card">
          {url ? <img src={url} alt="" className="size-full object-contain" /> : <span className="text-xs text-muted">—</span>}
        </span>
        <button className="btn-secondary" disabled={pending} onClick={() => ref.current?.click()}>{t("settings2.logoUpload")}</button>
        {url && <button className="btn-ghost text-muted" disabled={pending} onClick={() => run(() => removeLogo())}>{t("settings2.logoRemove")}</button>}
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const fd = new FormData();
            fd.set("logo", f);
            run(() => uploadLogo(fd));
            e.target.value = "";
          }}
        />
      </div>
      <p className="text-sm text-muted">{t("settings2.logoHint")}</p>
      <ErrorText error={error} />
    </div>
  );
}

export function TaskFieldsForm({ initial }: { initial: TaskFields }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [v, setV] = useState(initial);
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">{t("settings2.taskFields")}</h2>
      <p className="text-sm text-muted">{t("settings2.taskFieldsHint")}</p>
      <ul className="divide-y divide-line/60">
        {(Object.keys(v) as (keyof TaskFields)[]).map((k) => (
          <li key={k} className="flex min-h-12 items-center justify-between gap-3">
            <span>{t(`fields.${k}` as MessageKey)}</span>
            <Switch
              on={v[k]}
              label={t(`fields.${k}` as MessageKey)}
              disabled={pending}
              onChange={(on) => {
                const next = { ...v, [k]: on };
                setV(next);
                run(() => setTaskFields(next), { refresh: false });
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FeaturesForm({ features }: { features: { key: string; enabled: boolean; locked: boolean }[] }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">{t("settings2.features")}</h2>
      <p className="text-sm text-muted">{t("settings2.featuresHint")}</p>
      <ul className="divide-y divide-line/60">
        {features.map((f) => (
          <li key={f.key} className="flex min-h-12 items-center justify-between gap-3">
            <span>
              {t(`featureNames.${f.key}` as MessageKey)}
              {f.locked && <span className="ml-2 text-xs text-muted">({t("settings2.locked")})</span>}
            </span>
            <Switch on={f.enabled} label={t(`featureNames.${f.key}` as MessageKey)} disabled={pending || f.locked} onChange={(on) => run(() => setMyFirmFeature(f.key, on))} />
          </li>
        ))}
      </ul>
      <ErrorText error={error} />
    </div>
  );
}

export function ShiftAutocloseForm({ hours }: { hours: number }) {
  const { t } = useI18n();
  const { run } = useAction();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span>{t("settings2.shiftAutoclose")}</span>
      <Select className="!w-auto" defaultValue={hours} aria-label={t("settings2.shiftAutoclose")} onChange={(e) => run(() => setShiftAutoclose(Number(e.target.value)))}>
        {[8, 10, 12, 14, 16].map((h) => <option key={h} value={h}>{h} h</option>)}
      </Select>
    </div>
  );
}
