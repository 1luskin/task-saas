"use client";
import { useEffect } from "react";
import { startSyncLoop } from "@/lib/offline/queue";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    return startSyncLoop();
  }, []);
  return null;
}
