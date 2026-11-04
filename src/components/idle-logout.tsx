"use client";
import { useEffect } from "react";
import { logout } from "@/server/actions/auth";
import { clearQueue } from "@/lib/offline/queue";

const KEY = "app.lastActive";
/** Abmeldung nach längerer Inaktivität (Standard 12 h; über alle Tabs) */
export function IdleLogout({ hours = 12 }: { hours?: number }) {
  useEffect(() => {
    const mark = () => {
      try {
        localStorage.setItem(KEY, String(Date.now()));
      } catch {
        /* privat */
      }
    };
    const check = async () => {
      let last = Date.now();
      try {
        last = Number(localStorage.getItem(KEY) ?? Date.now());
      } catch {
        /* privat */
      }
      if (Date.now() - last > hours * 3600_000) {
        clearQueue();
        navigator.serviceWorker?.controller?.postMessage("clear-pages");
        await logout();
      }
    };
    void check();
    mark();
    const events = ["pointerdown", "keydown", "visibilitychange"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const iv = window.setInterval(check, 60_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      window.clearInterval(iv);
    };
  }, [hours]);
  return null;
}
