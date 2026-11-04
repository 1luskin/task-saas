"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { LEGAL_VERSION } from "@/legal/content";
import { recordConsent } from "@/server/actions/consent";

const KEY = "app.cookieConsent";

/** Hinweis: nur technisch notwendige Cookies. Bestätigung mit Datum + Textversion. */
export function CookieBanner() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  useEffect(() => {
    let stored: { version?: string } | null = null;
    try {
      stored = JSON.parse(localStorage.getItem(KEY) ?? "null");
    } catch {
      stored = null;
    }
    const needed = stored?.version !== LEGAL_VERSION;
    if (needed) {
      const id = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(id);
    }
  }, []);
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
