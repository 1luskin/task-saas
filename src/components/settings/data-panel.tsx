"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { cancelFirmDeletion, checkExportAllowed, requestFirmDeletion, resolveDataRequest } from "@/server/actions/dsgvo";
import { formatDate } from "@/lib/dates";
import { ReauthDialog } from "../reauth-dialog";
import { useAction, ErrorText } from "../use-action";
import { IconDownload, IconTrash } from "../icons";

/** Datei-Download (kein Seitenwechsel) */
function download(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type Req = { id: string; memberName: string; kind: string; created_at: string };

/** Chef: Komplett-Export (ZIP), Firma löschen (30 Tage), offene Datenanfragen */
export function DataPanel({ firmName, email, scheduledFor, requests }: { firmName: string; email: string; scheduledFor: string | null; requests: Req[] }) {
  const { t, locale } = useI18n();
  const { run, pending, error } = useAction();
  const [reauthFor, setReauthFor] = useState<null | "export" | "delete">(null);
  const [confirm, setConfirm] = useState("");

  const doExport = async () => {
    const r = await checkExportAllowed();
    if (!r.ok && r.error === "reauth") return setReauthFor("export");
    download("/api/export/firm");
  };
  const doDelete = () =>
    run(async () => {
      const r = await requestFirmDeletion(confirm);
      if (!r.ok && r.error === "reauth") {
        setReauthFor("delete");
        return { ok: true as const, data: undefined };
      }
      return r;
    });

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">{t("legal.dataTitle")}</h2>
      <button className="btn-secondary" onClick={doExport}>
        <IconDownload className="size-5" />
        {t("legal.exportFirm")}
      </button>

      {requests.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted">{t("legal.openRequests")}</div>
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-card px-3 py-2 text-sm">
              <span>{r.memberName} · {r.kind} · {formatDate(r.created_at.slice(0, 10), locale)}</span>
              <button className="btn-secondary !min-h-9 text-sm" onClick={() => run(() => resolveDataRequest(r.id, "done"))}>{t("legal.requestDone")}</button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-[14px] bg-danger-soft/50 p-4">
        <div className="font-semibold text-danger">{t("legal.deleteFirm")}</div>
        {scheduledFor ? (
          <>
            <p className="text-sm text-ink-2">{t("legal.deleteScheduled", { date: formatDate(scheduledFor.slice(0, 10), locale) })}</p>
            <button className="btn-secondary" disabled={pending} onClick={() => run(() => cancelFirmDeletion())}>{t("legal.cancelDeletion")}</button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-2">{t("legal.deleteFirmText")}</p>
            <input className="input" placeholder={t("legal.deleteFirmConfirm")} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label={t("legal.deleteFirmConfirm")} />
            <button className="btn-danger" disabled={pending || confirm.trim() !== firmName.trim()} onClick={doDelete}>
              <IconTrash className="size-5" />
              {t("legal.deleteFirm")}
            </button>
          </>
        )}
      </div>
      <ErrorText error={error} />
      {reauthFor && (
        <ReauthDialog
          email={email}
          onCancel={() => setReauthFor(null)}
          onDone={() => {
            const what = reauthFor;
            setReauthFor(null);
            if (what === "export") download("/api/export/firm");
            else doDelete();
          }}
        />
      )}
    </div>
  );
}
