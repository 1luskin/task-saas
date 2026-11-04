"use client";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { convertInbound, dismissInbound, setPublicSlug } from "@/server/actions/clients";
import { useAction, ErrorText } from "../use-action";
import { useState } from "react";

export function InboundActions({ id }: { id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending, error } = useAction();
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-primary !min-h-10 text-sm" disabled={pending} onClick={() => run(() => convertInbound(id), { onOk: (r) => router.push(`/boss/tasks/${(r.data as { taskId: string }).taskId}`) })}>{t("clients.convert")}</button>
      <button className="btn-ghost !min-h-10 text-sm" disabled={pending} onClick={() => run(() => dismissInbound(id))}>{t("clients.dismiss")}</button>
      <ErrorText error={error} />
    </div>
  );
}

export function PublicSlugForm({ slug, appUrl }: { slug: string | null; appUrl: string }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState(slug ?? "");
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">{t("clients.publicPage")}</h2>
      <p className="text-sm text-muted">{t("clients.publicHint")}</p>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(() => setPublicSlug(v)); }}>
        <span className="inline-flex min-h-11 items-center text-sm text-muted">{appUrl}/f/</span>
        <input className="input !w-auto min-w-0 flex-1" pattern="[a-z0-9-]{3,40}" value={v} onChange={(e) => setV(e.target.value.toLowerCase())} aria-label={t("clients.publicSlug")} />
        <button className="btn-secondary" disabled={pending}>{t("common.save")}</button>
      </form>
      {slug && <a className="text-sm text-link" href={`/f/${slug}`} target="_blank" rel="noreferrer">{appUrl}/f/{slug}</a>}
      <ErrorText error={error} />
    </div>
  );
}
