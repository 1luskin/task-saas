import { notFound } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { loadLinkView } from "@/server/client-link";
import { clientIpHash, hit } from "@/lib/rate-limit";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { logoUrl } from "@/lib/logo";
import { cx } from "@/components/ui";
import { ClientActions } from "./actions";

export const metadata = { title: "Auftrag", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STEPS = ["new", "in_progress", "review", "done"] as const;

/** Öffentlicher Kunden-Link: nur diese Aufgabe, nur per gültigem Token, mit Rate-Limit */
export default async function ClientLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t, locale } = await getI18n();
  if (!(await hit("publicLink", await clientIpHash()))) notFound();
  const v = await loadLinkView(token);
  if (!v) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6 text-center">
        <p className="text-muted">{t("cl.invalid")}</p>
      </main>
    );
  }
  const stage = v.task.status === "rework" ? 1 : STEPS.indexOf(v.task.status as (typeof STEPS)[number]);
  const logo = logoUrl(v.firm.logoPath);
  const Gallery = ({ title, urls }: { title: string; urls: string[] }) =>
    urls.length ? (
      <section className="space-y-2">
        <h2 className="font-semibold">{title}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-[12px] bg-card">
              <img src={u} alt="" className="size-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      </section>
    ) : null;

  return (
    <main className="pt-safe pb-safe mx-auto min-h-dvh max-w-xl space-y-4 px-4 py-6">
      <header className="flex items-center gap-3">
        {logo ? <img src={logo} alt="" className="size-12 rounded-[12px] object-contain" /> : <span className="flex size-12 items-center justify-center rounded-[12px] bg-surface font-display text-lg font-semibold">{v.firm.name.slice(0, 1)}</span>}
        <div className="font-display text-lg font-semibold">{v.firm.name}</div>
      </header>
      <section className="card-white space-y-4 p-5">
        <div>
          <div className="text-sm text-muted">{t("cl.status")}</div>
          <h1 className="text-2xl font-semibold">{v.task.title}</h1>
          {v.task.due_date && <div className="text-sm text-muted">{formatDate(v.task.due_date, locale)}{v.task.address ? ` · ${v.task.address}` : ""}</div>}
        </div>
        <ol className="grid grid-cols-4 gap-1.5" aria-label={t("cl.status")}>
          {STEPS.map((s, i) => (
            <li key={s} className="space-y-1.5">
              <div className={cx("h-1.5 rounded-full", i <= stage ? (s === "done" && stage === 3 ? "bg-ok" : "bg-accent-2") : "bg-surface-3")} />
              <div className={cx("text-xs", i === stage ? "font-semibold text-ink" : "text-muted")}>{t(`status.${s}`)}</div>
            </li>
          ))}
        </ol>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {v.assigneeFirstName && <div><dt className="text-muted">{t("cl.assignee")}</dt><dd className="font-medium">{v.assigneeFirstName}</dd></div>}
          {v.priceCents !== null && <div><dt className="text-muted">{t("cl.price")}</dt><dd className="font-medium tabular-nums">{formatMoney(v.priceCents, locale)}</dd></div>}
        </dl>
      </section>
      {Gallery({ title: t("cl.before"), urls: v.photos.before })}
      {Gallery({ title: t("cl.after"), urls: v.photos.after })}
      {!v.photos.before.length && !v.photos.after.length && Gallery({ title: t("cl.photos"), urls: v.photos.general })}
      <ClientActions token={token} status={v.task.status} reviewed={v.reviewed} />
    </main>
  );
}
