"use client";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";
import { InstallButton } from "./install-button";
import { IconPhone } from "../icons";

const noop = () => () => {};
function platform(): "ios" | "android" | "installed" | "other" {
  if (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone) return "installed";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/** Schritt-für-Schritt: auf dem Handy installieren (iOS: Safari-Teilen, Android: Installieren-Knopf) */
export function InstallHint() {
  const { t } = useI18n();
  const p = useSyncExternalStore(noop, platform, () => "other" as const);
  if (p === "installed") return <p className="text-sm text-ok">{t("install.installed")}</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-medium"><IconPhone className="size-5 text-link" />{t("install.title")}</div>
      {(p === "ios" || p === "other") && <p className="text-sm text-ink-2">{t("install.ios")}</p>}
      {(p === "android" || p === "other") && <p className="text-sm text-ink-2">{t("install.android")}</p>}
      <InstallButton />
    </div>
  );
}
