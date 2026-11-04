"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { IconDownload } from "../icons";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

/** "App installieren" (Android/Chrome/Edge). iOS: Teilen → Zum Home-Bildschirm. */
export function InstallButton() {
  const { t } = useI18n();
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!evt) return null;
  return (
    <button className="btn-secondary w-full" onClick={async () => { await evt.prompt(); setEvt(null); }}>
      <IconDownload className="size-5" />
      {t("settings.installHint")}
    </button>
  );
}
