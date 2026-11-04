"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { currentSubscription, disablePush, enablePush, pushSupported } from "@/lib/offline/push-client";
import { IconCheck } from "../icons";

export function PushToggle() {
  const { t } = useI18n();
  const [state, setState] = useState<"loading" | "on" | "off" | "unsupported" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = !pushSupported()
        ? "unsupported"
        : Notification.permission === "denied"
          ? "denied"
          : (await currentSubscription())
            ? "on"
            : "off";
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "unsupported") return <p className="text-sm text-muted">{t("settings.pushUnsupported")}</p>;
  if (state === "denied") return <p className="text-sm text-danger">{t("settings.pushDenied")}</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {state === "on" && <span className="chip bg-ok-soft text-ok"><IconCheck className="size-3.5" />{t("settings.pushOn")}</span>}
      <button
        className={state === "on" ? "btn-secondary" : "btn-primary"}
        disabled={state === "loading"}
        onClick={async () => {
          if (state === "on") {
            await disablePush();
            setState("off");
          } else {
            const r = await enablePush();
            setState(r === "ok" ? "on" : r === "denied" ? "denied" : r === "unsupported" ? "unsupported" : "off");
          }
        }}
      >
        {state === "on" ? t("settings.pushDisable") : t("settings.pushEnable")}
      </button>
    </div>
  );
}
