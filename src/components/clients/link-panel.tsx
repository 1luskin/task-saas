"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { createTaskLink, revokeTaskLink } from "@/server/actions/clients";
import { formatDate } from "@/lib/dates";
import { useAction, ErrorText } from "../use-action";

/** Chef: Kunden-Link erstellen/teilen/widerrufen */
export function ClientLinkPanel({ taskId, title, appUrl, link }: { taskId: string; title: string; appUrl: string; link: { id: string; token: string; expires_at: string } | null }) {
  const { t, locale } = useI18n();
  const { run, pending, error } = useAction();
  const [copied, setCopied] = useState(false);
  const url = link ? `${appUrl}/c/${link.token}` : null;
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">{t("clients.link")}</h2>
      <p className="text-sm text-muted">{t("clients.linkHint")}</p>
      {url ? (
        <>
          <div className="truncate rounded-[10px] bg-card px-3 py-2 font-mono text-xs">{url}</div>
          <div className="text-xs text-muted">{t("clients.validUntil", { date: formatDate(link!.expires_at.slice(0, 10), locale) })}</div>
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary !min-h-10 text-sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(t("clients.linkMessage", { title, url }))}`}>{t("clients.sendWhatsApp")}</a>
            <button className="btn-secondary !min-h-10 text-sm" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? t("common.copied") : t("common.copy")}</button>
            <a className="btn-secondary !min-h-10 text-sm" href={url} target="_blank" rel="noreferrer">{t("demoFirm.customer")}</a>
            <button className="btn-ghost !min-h-10 text-sm" disabled={pending} onClick={() => run(() => createTaskLink(taskId))}>{t("clients.regenerate")}</button>
            <button className="btn-ghost !min-h-10 text-sm text-danger" disabled={pending} onClick={() => run(() => revokeTaskLink(link!.id))}>{t("clients.revoke")}</button>
          </div>
        </>
      ) : (
        <button className="btn-secondary" disabled={pending} onClick={() => run(() => createTaskLink(taskId))}>{t("clients.createLink")}</button>
      )}
      <ErrorText error={error} />
    </div>
  );
}
