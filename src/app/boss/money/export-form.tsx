"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { IconDownload } from "@/components/icons";

export function ExportForm({ month, datev }: { month: string; datev?: "ready" | "setup" | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [m, setM] = useState(month);
  return (
    <div className="flex flex-wrap gap-2">
      <input
        type="month"
        className="input !w-auto"
        value={m}
        onChange={(e) => {
          setM(e.target.value);
          if (e.target.value) router.replace(`/boss/money?month=${e.target.value}`);
        }}
        aria-label={t("money.monthLabel")}
      />
      <a href={`/api/export/month?month=${m}`} className="btn-primary">
        <IconDownload className="size-5" />
        {t("money.exportXlsx")}
      </a>
      {datev === "ready" && <a href={`/api/export/datev?month=${m}`} className="btn-secondary"><IconDownload className="size-5" />{t("acc.export")}</a>}
      {datev === "setup" && <a href="/boss/settings#datev" className="btn-ghost" title={t("acc.notReady")}>{t("acc.setup")}</a>}
    </div>
  );
}
