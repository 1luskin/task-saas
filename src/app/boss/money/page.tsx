import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { formatDuration, monthPeriod, todayISO, weekPeriod } from "@/lib/dates";
import { loadFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { getMembers } from "@/server/queries";
import { PageTitle } from "@/components/ui";
import { ExportForm } from "./export-form";

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requireBossPage();
  const { t, locale } = await getI18n();
  const { month } = await searchParams;
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : todayISO().slice(0, 7);
  const [week, mon, members] = await Promise.all([
    loadFinance(ctx, weekPeriod()),
    loadFinance(ctx, monthPeriod(`${m}-01`)),
    getMembers(ctx, { includeArchived: true }),
  ]);
  const money = (c: number) => formatMoney(c, locale);
  const rows = [...mon.perMember.values()].sort((a, b) => b.totalCents - a.totalCents);

  const block = ({ title, f }: { title: string; f: typeof week }) => (
    <div className="card-white p-4">
      <div className="mb-3 font-semibold">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        <div><div className="text-sm text-muted">{t("money.revenue")}</div><div className="text-lg font-semibold sm:text-2xl">{money(f.revenueCents)}</div></div>
        <div><div className="text-sm text-muted">{t("money.payouts")}</div><div className="text-lg font-semibold sm:text-2xl">{money(f.payoutCents)}</div></div>
        <div><div className="text-sm text-muted">{t("money.profit")}</div><div className="text-lg font-semibold text-accent sm:text-2xl">{money(f.profitCents)}</div></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageTitle actions={<ExportForm month={m} />}>{t("money.title")}</PageTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        {block({ title: t("money.week"), f: week })}
        {block({ title: `${t("money.monthLabel")} ${m}`, f: mon })}
      </div>
      <div className="card-white overflow-x-auto">
        <div className="p-4 font-semibold">{t("money.perEmployee")} · {m}</div>
        <table className="w-full min-w-[520px] text-sm">
          <thead className="border-y border-line/70 bg-card text-left text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t("export.employee")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("money.tasks")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("money.hours")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("export.hourlyPay")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("export.fixedPay")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("export.payout")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.map((r) => (
              <tr key={r.memberId}>
                <td className="px-4 py-3">{members.find((x) => x.id === r.memberId)?.full_name ?? "?"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.tasksDone}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatDuration(r.minutes)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.hourlyCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.fixedCents)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(r.totalCents)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">—</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
