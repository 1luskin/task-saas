import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { monthPeriod, todayISO, weekPeriod } from "@/lib/dates";
import { loadFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { getMembers } from "@/server/queries";
import { PageTitle } from "@/components/ui";
import { IconDownload } from "@/components/icons";

export default async function ReportsPage() {
  const ctx = await requireBossPage();
  const { t, locale } = await getI18n();
  const [week, month, members] = await Promise.all([
    loadFinance(ctx, weekPeriod()),
    loadFinance(ctx, monthPeriod()),
    getMembers(ctx, { includeArchived: true }),
  ]);
  const name = (id: string) => members.find((m) => m.id === id)?.full_name ?? "?";

  const Bars = ({ title, f }: { title: string; f: typeof week }) => {
    const rows = [...f.perMember.values()].sort((a, b) => b.tasksDone - a.tasksDone);
    const max = Math.max(1, ...rows.map((r) => r.tasksDone));
    return (
      <div className="card-white p-4">
        <div className="mb-1 font-semibold">{title}</div>
        <div className="mb-4 text-sm text-muted">
          {t("money.profit")}: <span className="font-semibold text-accent">{formatMoney(f.profitCents, locale)}</span> · {t("money.payouts")}: {formatMoney(f.payoutCents, locale)}
        </div>
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.memberId}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{name(r.memberId)}</span>
                <span className="tabular-nums text-muted">{r.tasksDone} · {formatMoney(r.totalCents, locale)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-card">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(r.tasksDone / max) * 100}%` }} />
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-muted">—</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageTitle
        actions={
          <a href={`/api/reports/weekly-pdf?week=${todayISO()}`} className="btn-primary">
            <IconDownload className="size-5" />
            {t("reports.weeklyPdf")}
          </a>
        }
      >
        {t("reports.title")}
      </PageTitle>
      <h2 className="font-semibold text-muted">{t("reports.doneByEmployee")}</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title={t("reports.thisWeek")} f={week} />
        <Bars title={t("reports.thisMonth")} f={month} />
      </div>
    </div>
  );
}
