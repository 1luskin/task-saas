"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { IconDownload } from "@/components/icons";

export function ExportForm({ month }: { month: string }) {
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
    </div>
  );
}
