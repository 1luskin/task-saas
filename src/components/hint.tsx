"use client";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { dismissHint } from "@/server/actions/onboarding";

/** Schließbarer Tipp (Zustand pro Nutzer in user_settings.hints_dismissed) */
export function Hint({ id, dismissed, children }: { id: string; dismissed: string[]; children: React.ReactNode }) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(dismissed.includes(id));
  const [, start] = useTransition();
  if (hidden) return null;
  return (
    <div className="fade-up flex items-start gap-3 rounded-[14px] bg-accent-soft px-4 py-3 text-sm text-ink-2">
      <span className="min-w-0 flex-1">{children}</span>
      <button
        type="button"
        aria-label={t("hints.dismiss")}
        className="-m-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/5"
        onClick={() => {
          setHidden(true);
          start(async () => {
            await dismissHint(id);
          });
        }}
      >
        <X className="size-4" strokeWidth={1.8} />
      </button>
    </div>
  );
}
