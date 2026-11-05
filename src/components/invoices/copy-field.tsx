"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";

export function CopyField({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [ok, setOk] = useState(false);
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex gap-2">
        <input readOnly className="input min-w-0 flex-1" value={value} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn-secondary" onClick={async () => { try { await navigator.clipboard.writeText(value); setOk(true); } catch { /* */ } }}>{ok ? t("common.copied") : t("common.copy")}</button>
      </div>
    </div>
  );
}
