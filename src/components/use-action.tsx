"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";

type Result = { ok: true; data?: unknown } | { ok: false; error: string; message?: string };

/** Führt Server Actions aus und übersetzt Fehlercodes. */
export function useAction() {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run<R extends Result>(fn: () => Promise<R>, opts: { onOk?: (r: Extract<R, { ok: true }>) => void; refresh?: boolean } = {}) {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r) return; // redirect
        if (r.ok) {
          opts.onOk?.(r as Extract<R, { ok: true }>);
          if (opts.refresh !== false) router.refresh();
        } else {
          setError(
            r.message === "last_boss"
              ? t("employees.lastBoss")
              : r.error === "expired"
                ? t("trial.expiredError")
                : r.error === "forbidden" || r.error === "unauthenticated"
                ? t("common.forbidden")
                : r.error === "invalid"
                  ? t("common.invalid")
                  : r.error === "unavailable"
                    ? t("common.unavailable")
                    : t("common.error"),
          );
        }
      } catch (e) {
        // redirect() aus Server Actions wirft absichtlich
        if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
        setError(t("common.error"));
      }
    });
  }
  return { run, pending, error, setError };
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <p className="text-sm text-danger">{error}</p> : null;
}
