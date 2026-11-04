"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { moderateReview, saveLandingContent, savePlanPrice } from "@/server/actions/admin";
import { useAction, ErrorText } from "../use-action";

export function PlanPriceForm({ planId, value }: { planId: string; value: string }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState(value);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => savePlanPrice(planId, v)); }}>
      <label className="flex-1">
        <span className="label">{planId === "pro" ? "Pro" : "Start"} – {t("admin.planPrice")}</span>
        <input className="input" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder="[ЦЕНА]" />
      </label>
      <button className="btn-primary" disabled={pending}>{t("common.save")}</button>
      <ErrorText error={error} />
    </form>
  );
}

export function LandingJsonForm({ locale, value }: { locale: string; value: string }) {
  const { t } = useI18n();
  const { run, pending, error, setError } = useAction();
  const [v, setV] = useState(value);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          JSON.parse(v);
        } catch {
          return setError("JSON?");
        }
        run(() => saveLandingContent(locale, v));
      }}
    >
      <span className="label">{t("admin.landingJson")} – {locale.toUpperCase()}</span>
      <textarea className="input min-h-64 py-3 font-mono text-xs" value={v} onChange={(e) => setV(e.target.value)} spellCheck={false} />
      <p className="text-xs text-muted">{t("admin.landingHint")}</p>
      <button className="btn-primary" disabled={pending}>{t("common.save")}</button>
      <ErrorText error={error} />
    </form>
  );
}

export function ReviewModeration({ id }: { id: string }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <div className="flex gap-2">
      <button className="btn-primary !min-h-9 text-sm" disabled={pending} onClick={() => run(() => moderateReview(id, "approved"))}>{t("admin.approve")}</button>
      <button className="btn-secondary !min-h-9 text-sm" disabled={pending} onClick={() => run(() => moderateReview(id, "rejected"))}>{t("admin.reject")}</button>
    </div>
  );
}
