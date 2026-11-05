import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { formatDuration, monthPeriod, todayISO, weekPeriod } from "@/lib/dates";
import { loadFinance } from "@/lib/finance";
import { isEnabled } from "@/lib/features";
import { formatMoney } from "@/lib/money";
import { getMembers } from "@/server/queries";
import { PageTitle } from "@/components/ui";
import { Hint } from "@/components/hint";
import { ExportForm } from "./export-form";
import { AdjustForm, ExpenseDecision } from "@/components/money/adjust-form";
import { monthPeriod as mp } from "@/lib/dates";
import Link from "next/link";
import { Suspense } from "react";
import { AnalyticsCharts } from "@/components/charts/analytics";
import { ChartsSkeleton } from "@/components/skeletons";

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
  const datevOn = await isEnabled(ctx, "datev");
  const range = mp(`${m}-01`);
  const [{ data: pendingExp }, { data: adjustments }] = await Promise.all([
    ctx.supabase.from("expenses").select("*").eq("firm_id", ctx.firm.id).eq("status", "pending").order("created_at"),
    ctx.supabase.from("adjustments").select("*").eq("firm_id", ctx.firm.id).gte("effective_date", range.from).lt("effective_date", range.to).order("effective_date", { ascending: false }),
  ]);
  const name = (id: string) => members.find((x) => x.id === id)?.full_name ?? "?";
  const rows = [...mon.perMember.values()].sort((a, b) => b.totalCents - a.totalCents);

  const block = ({ title, f }: { title: string; f: typeof week }) => (
    <div className="card-white p-4">
      <div className="mb-3 font-semibold">{title}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div><div className="text-sm text-muted">{t("money.revenue")}</div><div className="text-lg font-semibold sm:text-2xl">{money(f.revenueCents)}</div></div>
        <div><div className="text-sm text-muted">{t("money.payouts")}</div><div className="text-lg font-semibold sm:text-2xl">{money(f.payoutCents)}</div></div>
        <div><div className="text-sm text-muted">{t("expense.materials")}</div><div className="text-lg font-semibold tabular-nums sm:text-2xl">{money(f.materialsCents)}</div></div>
        <div><div className="text-sm text-muted">{t("money.profit")}</div><div className="text-lg font-semibold text-link sm:text-2xl">{money(f.profitCents)}</div></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageTitle actions={<ExportForm month={m} datev={datevOn ? (ctx.firm.datev_consultant_no && ctx.firm.datev_client_no ? "ready" : "setup") : null} />}>{t("money.title")}</PageTitle>
      <Hint id="money" dismissed={ctx.settings.hints_dismissed}>{t("hints.money")}</Hint>
      <div className="grid gap-4 lg:grid-cols-2">
        {block({ title: t("money.week"), f: week })}
        {block({ title: `${t("money.monthLabel")} ${m}`, f: mon })}
      </div>
      <Suspense fallback={<ChartsSkeleton n={4} />}>
        <AnalyticsCharts ctx={ctx} variant="money" month={m} />
      </Suspense>
      <div className="card-white overflow-x-auto">
        <div className="p-4 font-semibold">{t("money.perEmployee")} · {m}</div>
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-y border-line/70 bg-card text-left text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t("export.employee")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("money.tasks")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("money.hours")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("export.hourlyPay")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("export.fixedPay")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("shift.title")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("adjust.title")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("expense.reimbursements")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("export.payout")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.map((r) => (
              <tr key={r.memberId}>
                <td className="px-4 py-3">
                  {members.find((x) => x.id === r.memberId)?.full_name ?? "?"}
                  <a className="ml-2 text-xs text-link" href={`/api/reports/member-pdf?member=${r.memberId}&month=${m}`}>PDF</a>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.tasksDone}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatDuration(r.minutes)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.hourlyCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.fixedCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.shiftCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.adjustCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.reimburseCents)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(r.totalCents)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted">—</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {(pendingExp ?? []).length > 0 && (
        <div className="card-white space-y-2 p-4">
          <h2 className="font-semibold">{t("expense.toApprove")}</h2>
          {pendingExp!.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-[12px] bg-card px-3 py-2 text-sm">
              <Link href={`/boss/tasks/${e.task_id}`} className="min-w-0 flex-1 truncate text-link">{e.description}</Link>
              <span className="text-muted">{name(e.member_id)}{e.reimburse ? ` · ${t("expense.reimbursements")}` : ""}</span>
              <span className="font-semibold tabular-nums">{money(e.amount_cents)}</span>
              <ExpenseDecision id={e.id} />
            </div>
          ))}
        </div>
      )}
      <div className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("adjust.title")} · {m}</h2>
        <AdjustForm members={members.filter((x) => !x.archived_at).map((x) => ({ id: x.id, full_name: x.full_name }))} />
        <ul className="divide-y divide-line/60 text-sm">
          {(adjustments ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>{a.effective_date} · {name(a.member_id)} · <span className="text-muted">{a.reason}</span></span>
              <span className={`font-semibold tabular-nums ${a.amount_cents < 0 ? "text-danger" : "text-ok"}`}>{money(a.amount_cents)}</span>
            </li>
          ))}
          {!adjustments?.length && <li className="py-2 text-muted">{t("adjust.none")}</li>}
        </ul>
      </div>
    </div>
  );
}
