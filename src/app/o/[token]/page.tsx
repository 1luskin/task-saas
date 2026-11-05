import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { invoiceTotals, SMALL_BUSINESS_NOTE } from "@/lib/invoice-calc";
import { loadPublicOffer } from "@/server/offer-public";
import { OfferDecision } from "./decision";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/** Öffentliche Angebotsseite – Zugriff nur mit Token, keine weiteren Daten der Firma */
export default async function PublicOfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t, locale } = await getI18n();
  const r = await loadPublicOffer(token);
  if (!r) return <main className="mx-auto max-w-xl p-6 text-center text-muted">{t("offerPublic.notFound")}</main>;
  const { off, items, firm } = r;
  const tot = invoiceTotals(items.map((i) => ({ ...i, qty: Number(i.qty) })), off.small_business);
  const expired = !!off.valid_until && off.valid_until < new Date().toISOString().slice(0, 10);
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <div>
        <div className="text-sm text-muted">{t("offerPublic.from", { firm: firm.legal_name || firm.name })}</div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("offerPublic.title", { number: off.number ?? "" })}</h1>
        {off.valid_until && <div className="text-sm text-muted">{t("offerPublic.validUntil", { date: formatDate(off.valid_until, locale) })}</div>}
      </div>
      <section className="card-white space-y-3 p-4">
        <h2 className="text-lg font-semibold">{off.title}</h2>
        {off.intro && <p className="whitespace-pre-wrap text-ink-2">{off.intro}</p>}
        <ul className="divide-y divide-line/60 text-sm">
          {tot.rows.map((i, n) => <li key={n} className="flex justify-between gap-3 py-2"><span>{i.description} · {i.qty} {i.unit}</span><span className="tabular-nums">{formatMoney(i.net, locale)}</span></li>)}
        </ul>
        <dl className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Netto</dt><dd className="tabular-nums">{formatMoney(tot.net, locale)}</dd></div>
          {!off.small_business && tot.groups.map((g) => <div key={g.rate} className="flex justify-between"><dt className="text-muted">USt {g.rate} %</dt><dd className="tabular-nums">{formatMoney(g.vat, locale)}</dd></div>)}
          <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>Gesamt</dt><dd className="tabular-nums">{formatMoney(tot.gross, locale)}</dd></div>
        </dl>
        {off.small_business && <p className="text-xs text-muted">{SMALL_BUSINESS_NOTE}</p>}
        <a className="btn-ghost" href={`/o/${token}/pdf`}>{t("offerPublic.pdf")}</a>
      </section>
      {off.status === "sent" && !expired ? <OfferDecision token={token} /> : (
        <p className="card-white p-4 text-center">{off.status === "accepted" ? t("offerPublic.accepted") : off.status === "declined" ? t("offerPublic.declined") : t("offerPublic.closed")}</p>
      )}
    </main>
  );
}
