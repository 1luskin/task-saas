"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { requestCode, verifyCode } from "@/server/actions/login";
import { Input } from "./ui";

/** Code erneut bestätigen, dann die gefährliche Aktion wiederholen (onDone) */
export function ReauthDialog({ email, onDone, onCancel }: { email: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="card-white w-full max-w-sm space-y-3 p-5">
        <h2 className="text-lg font-semibold">{t("auth.reauthTitle")}</h2>
        <p className="text-sm text-muted">{t("auth.reauthText", { email })}</p>
        {sent && (
          <Input inputMode="numeric" autoComplete="one-time-code" autoFocus className="text-center text-xl tracking-[0.3em] tabular-nums" value={code} onChange={(e) => setCode(e.target.value)} aria-label={t("auth.code")} />
        )}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>{t("common.cancel")}</button>
          <button
            className="btn-primary flex-1"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const r = sent ? await verifyCode({ email, code, reauth: true }) : await requestCode({ email });
              setBusy(false);
              if (!r.ok) return setError(r.error === "rate_limited" ? t("auth.rateLimited") : t("auth.wrongCode"));
              if (sent) onDone();
              else setSent(true);
            }}
          >
            {sent ? t("auth.verify") : t("auth.reauthSend")}
          </button>
        </div>
      </div>
    </div>
  );
}
