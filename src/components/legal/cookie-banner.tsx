"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { LEGAL_VERSION } from "@/legal/content";
import { recordConsent } from "@/server/actions/consent";

const KEY = "app.cookieConsent";
/** technisch notwendig: merkt sich nur, dass der Hinweis bestätigt wurde (Textversion) */
export const CONSENT_COOKIE = "cookie_ok";
const setConsentCookie = () => {
  document.cookie = `${CONSENT_COOKIE}=${LEGAL_VERSION}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
};

/** Hinweis: nur technisch notwendige Cookies. Bestätigung mit Datum + Textversion. Vom Server vorgerendert. */
export function CookieBanner({ initialShow }: { initialShow: boolean }) {
  const { t } = useI18n();
  const [show, setShow] = useState(initialShow);
  useEffect(() => {
    if (!initialShow) return;
    // ältere Bestätigung nur im localStorage → Cookie nachziehen, Hinweis ausblenden
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) ?? "null") as { version?: string } | null;
      if (stored?.version === LEGAL_VERSION) {
        setConsentCookie();
        const id = requestAnimationFrame(() => setShow(false));
        return () => cancelAnimationFrame(id);
      }
    } catch {
      /* privat */
    }
  }, [initialShow]);
  if (!show) return null;
  return (
    <div role="region" aria-label="Cookies" className="pb-safe fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4">
      <div className="card-white mx-auto flex max-w-2xl flex-wrap items-center gap-3 p-4 shadow-2xl shadow-black/40">
        <p className="min-w-0 flex-1 text-sm text-ink-2">
          {t("legal.cookieText")}{" "}
          <Link href="/datenschutz" className="text-link underline underline-offset-2">{t("legal.privacy")}</Link>
        </p>
        <button
          className="btn-primary"
          onClick={() => {
            try {
              localStorage.setItem(KEY, JSON.stringify({ version: LEGAL_VERSION, at: new Date().toISOString(), necessaryOnly: true }));
              setConsentCookie();
            } catch {
              /* privat */
            }
            setShow(false);
            void recordConsent("cookies", true).catch(() => {});
          }}
        >
          {t("legal.cookieOk")}
        </button>
      </div>
    </div>
  );
}
