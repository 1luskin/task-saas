"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { requestMyDeletion } from "@/server/actions/dsgvo";
import { useAction } from "@/components/use-action";
import { IconDownload } from "@/components/icons";

export function MyData({ requested }: { requested: boolean }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [done, setDone] = useState(requested);
  return (
    <div className="space-y-2">
      <a href="/api/export/me" className="btn-secondary w-full">
        <IconDownload className="size-5" />
        {t("legal.exportMine")}
      </a>
      {done ? (
        <p className="text-sm text-muted">{t("legal.deletionRequested")}</p>
      ) : (
        <button className="btn-ghost w-full text-danger" disabled={pending} onClick={() => confirm(t("common.confirmDelete")) && run(() => requestMyDeletion(), { onOk: () => setDone(true) })}>
          {t("legal.requestDeletion")}
        </button>
      )}
    </div>
  );
}
