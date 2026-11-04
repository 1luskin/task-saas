"use client";
import { useI18n } from "@/i18n/client";
import { setFirmFlag, setGlobalFlag } from "@/server/actions/admin";
import { useAction } from "../use-action";
import { cx } from "../ui";

export function GlobalFlagToggle({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  const { run, pending } = useAction();
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={flagKey}
      disabled={pending}
      onClick={() => run(() => setGlobalFlag(flagKey, !enabled))}
      className={cx("relative h-8 w-[52px] shrink-0 rounded-full transition", enabled ? "bg-accent" : "bg-surface-3")}
    >
      <span className={cx("absolute top-1 size-6 rounded-full bg-white transition-all", enabled ? "left-[24px]" : "left-1")} />
    </button>
  );
}

export function FirmFlagSelect({ firmId, flagKey, value }: { firmId: string; flagKey: string; value: "default" | "on" | "off" }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <select
      className="input !min-h-9 !w-auto text-sm"
      disabled={pending}
      value={value}
      aria-label={flagKey}
      onChange={(e) => run(() => setFirmFlag(firmId, flagKey, e.target.value === "default" ? null : e.target.value === "on"))}
    >
      <option value="default">{t("admin.useDefault")}</option>
      <option value="on">{t("admin.forceOn")}</option>
      <option value="off">{t("admin.forceOff")}</option>
    </select>
  );
}
