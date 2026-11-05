import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { isEnabled } from "@/lib/features";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { serverEnv } from "@/lib/env";
import { cx, PageTitle } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";
import { OfferEditor, OfferToInvoice } from "@/components/invoices/offer-editor";
import { CopyField } from "@/components/invoices/copy-field";

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await requireBossPage();
  if (!(await isEnabled(ctx, "invoices"))) notFound();
  const { t, locale } = await getI18n();
  const { data: off } = await ctx.supabase.from("offers").select("*").eq("id", id).eq("firm_id", ctx.firm.id).maybeSingle();
  if (!off) notFound();
  const { data: items } = await ctx.supabase.from("offer_items").select("*").eq("offer_id", id).order("position");
  const back = <Link href="/boss/invoices?tab=offers" className="inline-flex min-h-10 items-center gap-1 text-muted hover:text-ink"><IconChevronLeft className="size-5" />{t("common.back")}</Link>;
  const title = `${t("inv.offer")} ${off.number ?? `(${t("inv.draft")})`}`;
  if (off.status === "draft") {
    return (
      <div className="mx-auto max-w-5xl space-y-3">
        {back}
        <PageTitle>{title}</PageTitle>
        <OfferEditor off={off} items={items ?? []} smallBusiness={ctx.firm.small_business} defaultVat={(ctx.firm.small_business ? 0 : ctx.firm.vat_rate) as 0 | 7 | 19} />
      </div>
    );
  }
  const url = `${serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/o/${off.token}`;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {back}
      <PageTitle>{title}</PageTitle>
      <div className="card-white space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx("chip", off.status === "accepted" ? "bg-ok-soft text-ok" : off.status === "declined" ? "bg-danger-soft text-danger" : "bg-accent-soft text-link")}>{t(`inv.ost_${off.status}`)}</span>
          {off.accepted_name && off.status === "accepted" && <span className="text-sm text-muted">{t("inv.acceptedBy", { name: off.accepted_name })} · {off.decided_at ? formatDateTime(off.decided_at, locale) : ""}</span>}
        </div>
        <h2 className="text-lg font-semibold">{off.title}</h2>
        <p className="text-sm text-muted">{off.buyer_name}{off.buyer_address ? ` · ${off.buyer_address}` : ""}{off.valid_until ? ` · ${t("offerPublic.validUntil", { date: formatDate(off.valid_until, locale) })}` : ""}</p>
        <ul className="divide-y divide-line/60 text-sm">
          {(items ?? []).map((i) => <li key={i.id} className="flex justify-between gap-3 py-2"><span>{i.description} · {Number(i.qty)} {i.unit}</span><span className="tabular-nums">{formatMoney(Math.round(Number(i.qty) * i.unit_price_cents), locale)}</span></li>)}
        </ul>
        <p className="text-right font-semibold tabular-nums">{t("inv.gross")}: {formatMoney(off.gross_cents, locale)}</p>
        {off.status === "sent" && <CopyField label={t("inv.link")} value={url} />}
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href={`/api/offers/${off.id}/pdf`}>{t("inv.pdf")}</a>
          {off.status === "accepted" && <OfferToInvoice offerId={off.id} />}
          {off.task_id && <Link className="btn-ghost" href={`/boss/tasks/${off.task_id}`}>{t("inv.toTask")}</Link>}
        </div>
      </div>
    </div>
  );
}
