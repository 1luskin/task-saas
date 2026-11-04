"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { setOnSynced, useQueue } from "@/lib/offline/queue";
import { useI18n } from "@/i18n/client";
import { IconWifiOff } from "../icons";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Zeigt Offline-Status + wartende Änderungen; lädt Daten nach erfolgreichem Sync neu. */
export function OfflineBanner() {
  const { t } = useI18n();
  const router = useRouter();
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const queue = useQueue();

  useEffect(() => {
    setOnSynced(() => router.refresh());
    return () => setOnSynced(null);
  }, [router]);

  if (online && queue.length === 0) return null;
  return (
    <div className="sticky top-0 z-40 flex items-center gap-2 bg-surface-3 px-4 py-2 text-sm text-ink">
      <IconWifiOff className="size-4 shrink-0" />
      <span className="flex-1">{online ? t("offline.pending", { n: queue.length }) : t("offline.banner")}</span>
      {!online && queue.length > 0 && <span className="chip bg-white/15">{queue.length}</span>}
    </div>
  );
}
