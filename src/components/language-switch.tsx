"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { setLocaleCookie } from "@/server/actions/auth";
import { updateMyProfile } from "@/server/actions/members";
import { cx } from "./ui";

/** Sprachwahl. `persist` speichert zusätzlich im Profil (für Push-Texte). */
export function LanguageSwitch({ persist = false, large = false }: { persist?: boolean; large?: boolean }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={cx("inline-flex rounded-[12px] bg-card p-1", large && "w-full")}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (persist) await updateMyProfile({ locale: l });
              else await setLocaleCookie(l);
              router.refresh();
            })
          }
          className={cx(
            "rounded-[9px] px-3 text-sm font-medium transition",
            large ? "min-h-12 flex-1" : "min-h-9",
            l === locale ? "bg-surface shadow-sm text-ink" : "text-muted",
          )}
        >
          {large ? LOCALE_LABELS[l] : l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
