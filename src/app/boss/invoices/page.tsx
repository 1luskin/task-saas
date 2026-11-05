import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { isEnabled } from "@/lib/features";
import { formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isInvoiceOverdue } from "@/lib/invoice-calc";
import { cx, EmptyState, PageTitle } from "@/components/ui";
import { LoadMore, parseLimit } from "@/components/load-more";
import { NewDocButton } from "@/components/invoices/offer-editor";

const CHIP: Record<string, string> = {
  draft: "bg-surface-3 text-ink-2", sent: "bg-accent-soft text-link", paid: "bg-ok-soft text-ok", cancelled: "bg-surface-3 text-muted line-through",
  overdue: "bg-danger-soft text-danger", accepted: "bg-ok-soft text-ok", declined: "bg-danger-soft text-danger",
};

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ tab?: string; limit?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "offers" ? "offers" : "invoices";
  const limit = parseLimit(sp.limit);
  const ctx = await requireBossPage();
  if (!(await isEnabled(ctx, "invoices"))) notFound();
  const { t, locale } = await getI18n();
  const today = todayISO();
  const tabs = (
    <nav className="mb-4 inline-flex rounded-[12px] bg-surface p-1">
      {(["invoices", "offers"] as const).map((k) => (
        <Link key={k} href={`/boss/invoices?tab=${k}`} aria-current={tab === k ? "page" : undefined}
          className={cx("min-h-10 rounded-[9px] px-3 py-2 text-sm", tab === k ? "bg-surface-3 text-ink" : "text-muted hover:text-ink")}>{t(`inv.${k}`)}</Link>
      ))}
    </nav>
  );

  if (tab === "offers") {
    const { data: offers } = await ctx.supabase.from("offers").select("*").eq("firm_id", ctx.firm.id).order("created_at", { ascending: false }).limit(limit);
    return (
      <div>
        <PageTitle actions={<NewDocButton kind="offer" label={t("inv.newOffer")} />}>{t("inv.title")}</PageTitle>
        {tabs}
        <section className="card-white divide-y divide-line/60">
          {(offers ?? []).map((o) => (
            <Link key={o.id} href={`/boss/offers/${o.id}`} className="flex min-h-14 flex-wrap items-center gap-3 px-4 py-3 hover:bg-card">
              <span className="w-28 text-sm tabular-nums text-muted">{o.number ?? t("inv.draft")}</span>
              <span className="min-w-0 flex-1"><span className="font-medium">{o.title}</span><span className="block text-sm text-muted">{o.buyer_name || "—"}</span></span>
              <span className="tabular-nums">{formatMoney(o.gross_cents, locale)}</span>
              <span className={cx("chip", CHIP[o.status])}>{t(`inv.ost_${o.status}`)}</span>
            </Link>
          ))}
          {!offers?.length && <EmptyState>{t("inv.noneOffers")}</EmptyState>}
          <LoadMore shown={(offers ?? []).length} limit={limit} href={(n) => `/boss/invoices?tab=offers&limit=${n}`} />
        </section>
      </div>
    );
  }

  const { data: invoices } = await ctx.supabase.from("invoices").select("*").eq("firm_id", ctx.firm.id).order("created_at", { ascending: false }).limit(limit);
  const open = (invoices ?? []).filter((i) => i.status === "sent" && i.kind === "invoice").reduce((s, i) => s + i.gross_cents, 0);
  return (
    <div>
      <PageTitle actions={<NewDocButton kind="invoice" label={t("inv.newInvoice")} />}>{t("inv.title")}</PageTitle>
      {tabs}
      <p className="mb-3 text-sm text-muted">{t("inv.openSum")}: <span className="tabular-nums text-ink">{formatMoney(open, locale)}</span></p>
      <section className="card-white divide-y divide-line/60">
        {(invoices ?? []).map((i) => {
          const st = isInvoiceOverdue(i, today) ? "overdue" : i.status;
          return (
            <Link key={i.id} href={`/boss/invoices/${i.id}`} className="flex min-h-14 flex-wrap items-center gap-3 px-4 py-3 hover:bg-card">
              <span className="w-28 text-sm tabular-nums text-muted">{i.number ?? t("inv.draft")}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{i.buyer_name || "—"}</span>
                <span className="block text-sm text-muted">{i.kind === "storno" ? t("inv.storno") : t("inv.invoice")}{i.issue_date ? ` · ${formatDate(i.issue_date, locale)}` : ""}{i.due_date && i.status === "sent" ? ` · ${t("inv.dueDate").split(" (")[0]} ${formatDate(i.due_date, locale)}` : ""}</span>
              </span>
              <span className="tabular-nums">{formatMoney(i.gross_cents, locale)}</span>
              <span className={cx("chip", CHIP[st])}>{t(`inv.st_${st}`)}</span>
            </Link>
          );
        })}
        {!invoices?.length && <EmptyState>{t("inv.none")}</EmptyState>}
        <LoadMore shown={(invoices ?? []).length} limit={limit} href={(n) => `/boss/invoices?limit=${n}`} />
      </section>
    </div>
  );
}
