import { requireStaffPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { formatDate, formatDuration, monthPeriod, todayISO, weekPeriod } from "@/lib/dates";
import { loadFinance, loadPending } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { buildPeriodReport } from "@/server/month-report";
import { EmptyState } from "@/components/ui";
import Link from "next/link";

export default async function EarningsPage() {
  const ctx = await requireStaffPage();
  const { t, locale } = await getI18n();
  const today = todayISO();
  // RLS + memberId: ausschließlich eigene Zahlen, keine Kundenpreise
  const [week, month, report, pending] = await Promise.all([
    loadFinance(ctx, weekPeriod(today), { memberId: ctx.member.id }),
    loadFinance(ctx, monthPeriod(today), { memberId: ctx.member.id }),
    buildPeriodReport(ctx, monthPeriod(today)),
    loadPending(ctx, ctx.member.id),
  ]);
  const w = week.perMember.get(ctx.member.id);
  const m = month.perMember.get(ctx.member.id);
  const mp = monthPeriod(today);
  const { data: adjustments } = await ctx.supabase.from("adjustments").select("*").eq("member_id", ctx.member.id).gte("effective_date", mp.from).lt("effective_date", mp.to).order("effective_date", { ascending: false });
  const rows = report.rows.filter((r) => r.payoutCents > 0 || r.minutes > 0).reverse();

  const card = ({ title, e }: { title: string; e: typeof w }) => (
    <div className="card-white p-4">
      <div className="text-sm text-muted">{title}</div>
      <div className="mt-1 text-3xl font-semibold text-link">{formatMoney(e?.totalCents ?? 0, locale)}</div>
      <div className="mt-2 space-y-0.5 text-sm text-muted">
        <div>{t("staff.hourly")}: {formatDuration(e?.minutes ?? 0)} · {formatMoney(e?.hourlyCents ?? 0, locale)}</div>
        <div>{t("staff.fixed")}: {formatMoney(e?.fixedCents ?? 0, locale)}</div>
        {(e?.shiftCents ?? 0) !== 0 && <div>{t("shift.title")}: {formatDuration(e?.shiftMinutes ?? 0)} · {formatMoney(e?.shiftCents ?? 0, locale)}</div>}
        {(e?.adjustCents ?? 0) !== 0 && <div>{t("adjust.title")}: {formatMoney(e?.adjustCents ?? 0, locale)}</div>}
        {(e?.reimburseCents ?? 0) !== 0 && <div>{t("expense.reimbursements")}: {formatMoney(e?.reimburseCents ?? 0, locale)}</div>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.earnings")}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {card({ title: t("staff.earningsWeek"), e: w })}
        {card({ title: t("staff.earningsMonth"), e: m })}
      </div>
      {pending.cents > 0 && (
        <div className="card-white flex items-center justify-between gap-3 p-4">
          <div>
            <div className="font-medium">{t("staff.pending")}</div>
            <div className="text-sm text-muted">{t("staff.pendingHint")}</div>
          </div>
          <div className="text-xl font-semibold tabular-nums text-review">{formatMoney(pending.cents, locale)}</div>
        </div>
      )}
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
      {(adjustments ?? []).length > 0 && (
        <>
          <h2 className="font-semibold">{t("adjust.title")}</h2>
          <div className="card-white divide-y divide-line/70">
            {adjustments!.map((a) => (
              <div key={a.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.amount_cents < 0 ? t("adjust.deduction") : t("adjust.bonus")}</div>
                  <div className="text-sm text-muted">{formatDate(a.effective_date, locale, { day: "2-digit", month: "2-digit" })} · {a.reason}</div>
                </div>
                <div className={`text-lg font-semibold tabular-nums ${a.amount_cents < 0 ? "text-danger" : "text-ok"}`}>{formatMoney(a.amount_cents, locale)}</div>
              </div>
            ))}
          </div>
        </>
      )}
      <Link href="/staff/times" className="btn-secondary w-full">{t("times.mine")}</Link>
    </div>
  );
}
