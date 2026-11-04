"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/config";
import { setNotifyPref } from "@/server/actions/settings";
import { cx } from "../ui";

export function NotifyPrefs({ types, off }: { types: readonly string[]; off: string[] }) {
  const { t } = useI18n();
  const [disabled, setDisabled] = useState(new Set(off));
  return (
    <ul className="divide-y divide-line/60">
      {types.map((tp) => {
        const on = !disabled.has(tp);
        return (
          <li key={tp} className="flex min-h-14 items-center justify-between gap-3 px-4 lg:min-h-12">
            <span>{t(`notifyTypes.${tp}` as MessageKey)}</span>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={t(`notifyTypes.${tp}` as MessageKey)}
              onClick={() => {
                const next = new Set(disabled);
                if (on) next.add(tp); else next.delete(tp);
                setDisabled(next);
                void setNotifyPref(tp, !on);
              }}
              className={cx("relative h-8 w-[52px] shrink-0 rounded-full transition", on ? "bg-accent" : "bg-surface-3")}
            >
              <span className={cx("absolute top-1 size-6 rounded-full bg-white transition-all", on ? "left-[24px]" : "left-1")} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
