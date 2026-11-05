import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { isEnabled } from "@/lib/features";
import { formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { invoiceTotals, isInvoiceOverdue } from "@/lib/invoice-calc";
import { cx, PageTitle } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";
import { InvoiceEditor, IssuedActions } from "@/components/invoices/invoice-editor";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await requireBossPage();
  if (!(await isEnabled(ctx, "invoices"))) notFound();
  const { t, locale } = await getI18n();
  const { data: inv } = await ctx.supabase.from("invoices").select("*").eq("id", id).eq("firm_id", ctx.firm.id).maybeSingle();
  if (!inv) notFound();
  const [{ data: items }, { data: related }] = await Promise.all([
    ctx.supabase.from("invoice_items").select("*").eq("invoice_id", id).order("position"),
    ctx.supabase.from("invoices").select("id, number, kind").or(`id.eq.${inv.cancels_id ?? "00000000-0000-0000-0000-000000000000"},cancels_id.eq.${inv.id}`),
  ]);
  const cancels = related?.find((r) => r.id === inv.cancels_id);
  const cancelledBy = related?.find((r) => r.id !== inv.cancels_id && r.kind === "storno");
  const back = <Link href="/boss/invoices" className="inline-flex min-h-10 items-center gap-1 text-muted hover:text-ink"><IconChevronLeft className="size-5" />{t("common.back")}</Link>;
  const title = `${inv.kind === "storno" ? t("inv.storno") : t("inv.invoice")} ${inv.number ?? `(${t("inv.draft")})`}`;
  const defaultVat = (ctx.firm.small_business ? 0 : ctx.firm.vat_rate) as 0 | 7 | 19;

  if (inv.status === "draft") {
    return (
      <div className="mx-auto max-w-5xl space-y-3">
        {back}
        <PageTitle>{title}</PageTitle>
        <InvoiceEditor inv={inv} items={items ?? []} smallBusiness={ctx.firm.small_business} defaultVat={defaultVat} />
      </div>
    );
  }
  const tot = invoiceTotals((items ?? []).map((i) => ({ ...i, qty: Number(i.qty) })), inv.small_business);
  const st = isInvoiceOverdue(inv, todayISO()) ? "overdue" : inv.status;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {back}
      <PageTitle>{title}</PageTitle>
      <div className="card-white space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx("chip", st === "paid" ? "bg-ok-soft text-ok" : st === "overdue" ? "bg-danger-soft text-danger" : st === "cancelled" ? "bg-surface-3 text-muted" : "bg-accent-soft text-link")}>{t(`inv.st_${st}`)}</span>
          {cancels && <Link className="text-sm text-link" href={`/boss/invoices/${cancels.id}`}>{t("inv.cancels", { number: cancels.number ?? "" })}</Link>}
          {cancelledBy && <Link className="text-sm text-link" href={`/boss/invoices/${cancelledBy.id}`}>{t("inv.cancelledBy", { number: cancelledBy.number ?? "" })}</Link>}
        </div>
        <p className="text-sm text-muted">{t("inv.locked", { date: inv.retain_until ? formatDate(inv.retain_until, locale) : "—" })}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">{t("inv.buyer")}</dt><dd>{inv.buyer_name}<br />{inv.buyer_street}<br />{inv.buyer_zip} {inv.buyer_city}</dd></div>
          <div><dt className="text-muted">{t("inv.issueDate").split(" (")[0]}</dt><dd>{inv.issue_date ? formatDate(inv.issue_date, locale) : "—"}</dd></div>
          <div><dt className="text-muted">{t("inv.serviceDate")}</dt><dd>{inv.service_date ? formatDate(inv.service_date, locale) : "—"}{inv.service_date_to ? ` – ${formatDate(inv.service_date_to, locale)}` : ""}</dd></div>
          <div><dt className="text-muted">{t("inv.dueDate").split(" (")[0]}</dt><dd>{inv.due_date ? formatDate(inv.due_date, locale) : "—"}</dd></div>
        </dl>
        <table className="w-full text-sm">
          <thead className="text-left text-muted"><tr><th className="py-1 font-medium">{t("inv.description")}</th><th className="text-right font-medium">{t("inv.qty")}</th><th className="text-right font-medium">{t("inv.price")}</th><th className="text-right font-medium">{t("inv.vat")}</th><th className="text-right font-medium">{t("inv.net")}</th></tr></thead>
          <tbody className="divide-y divide-line/60">
            {tot.rows.map((r, i) => (
              <tr key={i}><td className="py-2">{r.description}</td><td className="text-right tabular-nums">{r.qty} {r.unit}</td><td className="text-right tabular-nums">{formatMoney(r.unit_price_cents, locale)}</td><td className="text-right">{inv.small_business ? "—" : `${r.vat_rate} %`}</td><td className="text-right tabular-nums">{formatMoney(r.net, locale)}</td></tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted">{t("inv.net")}</dt><dd className="tabular-nums">{formatMoney(inv.net_cents, locale)}</dd></div>
          {!inv.small_business && tot.groups.map((g) => <div key={g.rate} className="flex justify-between"><dt className="text-muted">{t("inv.vatSum")} {g.rate} %</dt><dd className="tabular-nums">{formatMoney(g.vat, locale)}</dd></div>)}
          <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>{t("inv.gross")}</dt><dd className="tabular-nums">{formatMoney(inv.gross_cents, locale)}</dd></div>
        </dl>
      </div>
      <IssuedActions inv={inv} />
    </div>
  );
}
