import { requireStaffPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { formatDate, formatDuration, monthPeriod, todayISO, weekPeriod } from "@/lib/dates";
import { loadFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { buildPeriodReport } from "@/server/month-report";
import { EmptyState } from "@/components/ui";

export default async function EarningsPage() {
  const ctx = await requireStaffPage();
  const { t, locale } = await getI18n();
  const today = todayISO();
  // RLS + memberId: ausschließlich eigene Zahlen, keine Kundenpreise
  const [week, month, report] = await Promise.all([
    loadFinance(ctx, weekPeriod(today), { memberId: ctx.member.id }),
    loadFinance(ctx, monthPeriod(today), { memberId: ctx.member.id }),
    buildPeriodReport(ctx, monthPeriod(today)),
  ]);
  const w = week.perMember.get(ctx.member.id);
  const m = month.perMember.get(ctx.member.id);
  const rows = report.rows.filter((r) => r.payoutCents > 0 || r.minutes > 0).reverse();

  const Card = ({ title, e }: { title: string; e: typeof w }) => (
    <div className="card-white p-4">
      <div className="text-sm text-muted">{title}</div>
      <div className="mt-1 text-3xl font-semibold text-accent">{formatMoney(e?.totalCents ?? 0, locale)}</div>
      <div className="mt-2 space-y-0.5 text-sm text-muted">
        <div>{t("staff.hourly")}: {formatDuration(e?.minutes ?? 0)} · {formatMoney(e?.hourlyCents ?? 0, locale)}</div>
        <div>{t("staff.fixed")}: {formatMoney(e?.fixedCents ?? 0, locale)}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.earnings")}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title={t("staff.earningsWeek")} e={w} />
        <Card title={t("staff.earningsMonth")} e={m} />
      </div>
      <h2 className="font-semibold">{t("staff.perTask")}</h2>
      <div className="card-white divide-y divide-line/70">
        {rows.length === 0 && <EmptyState>—</EmptyState>}
        {rows.map((r) => (
          <div key={r.taskId} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{r.title}</div>
              <div className="text-sm text-muted">
                {r.date ? formatDate(r.date.slice(0, 10), locale, { day: "2-digit", month: "2-digit" }) : ""}
                {r.minutes > 0 && ` · ${formatDuration(r.minutes)}`}
                {r.fixedCents > 0 && ` · ${t("staff.fixed")} ${formatMoney(r.fixedCents, locale)}`}
              </div>
            </div>
            <div className="text-lg font-semibold tabular-nums">{formatMoney(r.payoutCents, locale)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
