"use client";
import { useI18n } from "@/i18n/client";
import { recordConsent } from "@/server/actions/consent";
import { useGeo } from "./geo-context";
import { IconPin } from "../icons";

/** Einwilligung beim ersten Mal – nur wenn die Firma die Funktion eingeschaltet hat */
export function GeoConsent() {
  const { t } = useI18n();
  const { enabled, consent, setConsent } = useGeo();
  if (!enabled || consent !== null) return null;
  const decide = (v: boolean) => {
    setConsent(v);
    void recordConsent("geolocation", v);
  };
  return (
    <div className="card-white space-y-3 p-4">
      <div className="flex items-center gap-2 font-semibold"><IconPin className="size-5 text-link" />{t("geo.consentTitle")}</div>
      <p className="text-sm text-ink-2">{t("geo.consentText")}</p>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={() => decide(false)}>{t("geo.deny")}</button>
        <button className="btn-primary" onClick={() => decide(true)}>{t("geo.allow")}</button>
      </div>
    </div>
  );
}
