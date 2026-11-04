import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { AuthError, assertBoss } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { monthPeriod, todayISO, formatDate } from "@/lib/dates";
import { buildPeriodReport } from "@/server/month-report";
import { isEnabled } from "@/lib/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Monatsübersicht als .xlsx für den Steuerberater. ?month=YYYY-MM */
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await assertBoss();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 401 });
    throw e;
  }
  if (!(await isEnabled(ctx, "excel_export"))) return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const { t, locale } = await getI18n();
  const monthParam = new URL(req.url).searchParams.get("month");
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : todayISO().slice(0, 7);
  const period = monthPeriod(`${month}-01`);
  const { fin, rows, memberById } = await buildPeriodReport(ctx, period);

  const wb = new ExcelJS.Workbook();
  wb.creator = ctx.firm.name;
  wb.created = new Date();
  const euro = '#,##0.00 "€"';
  const name = (id: string | null) => (id ? memberById.get(id)?.full_name ?? "?" : "—");

  // Blatt 1: Übersicht pro Mitarbeiter
  const s = wb.addWorksheet(t("export.sheetSummary"));
  s.addRow([ctx.firm.name]).font = { bold: true, size: 14 };
  s.addRow([`${t("money.monthLabel")}: ${month}`]);
  s.addRow([]);
  const head = s.addRow([t("export.employee"), t("export.hours"), t("export.hourlyPay"), t("export.fixedPay"), t("export.payout"), t("money.tasks"), t("shift.title"), t("adjust.title"), t("expense.reimbursements")]);
  head.font = { bold: true };
  for (const m of [...fin.perMember.values()].sort((a, b) => name(a.memberId).localeCompare(name(b.memberId)))) {
    s.addRow([name(m.memberId), +((m.minutes + m.shiftMinutes) / 60).toFixed(2), m.hourlyCents / 100, m.fixedCents / 100, m.totalCents / 100, m.tasksDone, m.shiftCents / 100, m.adjustCents / 100, m.reimburseCents / 100]);
  }
  s.addRow([]);
  s.addRow([t("money.revenue"), null, null, null, fin.revenueCents / 100]).font = { bold: true };
  s.addRow([t("money.payouts"), null, null, null, fin.payoutCents / 100]).font = { bold: true };
  s.addRow([t("expense.materials"), null, null, null, fin.materialsCents / 100]).font = { bold: true };
  s.addRow([t("money.profit"), null, null, null, fin.profitCents / 100]).font = { bold: true };
  s.columns.forEach((c, i) => {
    c.width = i === 0 ? 30 : 16;
    if ((i >= 2 && i <= 4) || i >= 6) c.numFmt = euro;
  });

  // Blatt 2: Aufgaben
  const d = wb.addWorksheet(t("export.sheetTasks"));
  d.columns = [
    { header: t("export.date"), key: "date", width: 12 },
    { header: t("export.task"), key: "task", width: 40 },
    { header: t("export.employee"), key: "emp", width: 24 },
    { header: t("export.hours"), key: "hours", width: 10 },
    { header: t("export.hourlyPay"), key: "hourly", width: 14, style: { numFmt: euro } },
    { header: t("export.fixedPay"), key: "fixed", width: 14, style: { numFmt: euro } },
    { header: t("export.payout"), key: "payout", width: 14, style: { numFmt: euro } },
    { header: t("export.clientPrice"), key: "client", width: 14, style: { numFmt: euro } },
    { header: t("expense.materials"), key: "materials", width: 14, style: { numFmt: euro } },
    { header: t("export.profit"), key: "profit", width: 14, style: { numFmt: euro } },
  ];
  d.getRow(1).font = { bold: true };
  for (const r of rows) {
    d.addRow({
      date: r.date ? formatDate(r.date.slice(0, 10), locale) : "",
      task: r.title,
      emp: name(r.memberId),
      hours: +(r.minutes / 60).toFixed(2),
      hourly: r.hourlyCents / 100,
      fixed: r.fixedCents / 100,
      payout: r.payoutCents / 100,
      client: r.clientPriceCents / 100,
      materials: r.materialsCents / 100,
      profit: r.profitCents / 100,
    });
  }
  d.views = [{ state: "frozen", ySplit: 1 }];

  // Blatt 3: Ausgaben (genehmigt) mit Link zum Beleg in der App (Anmeldung nötig – keine öffentlichen Links)
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const ids = fin.doneTasks.map((x) => x.id);
  const { data: exp } = ids.length ? await ctx.supabase.from("expenses").select("*").in("task_id", ids).eq("status", "approved") : { data: [] };
  const x = wb.addWorksheet(t("expense.title"));
  x.columns = [
    { header: t("export.task"), key: "task", width: 36 },
    { header: t("expense.what"), key: "what", width: 30 },
    { header: t("export.employee"), key: "emp", width: 22 },
    { header: t("expense.amount"), key: "amount", width: 12, style: { numFmt: euro } },
    { header: t("expense.reimbursements"), key: "re", width: 12 },
    { header: t("expense.receipt"), key: "link", width: 40 },
  ];
  x.getRow(1).font = { bold: true };
  for (const e of exp ?? []) {
    const row = x.addRow({
      task: fin.doneTasks.find((k) => k.id === e.task_id)?.title ?? "",
      what: e.description,
      emp: name(e.member_id),
      amount: e.amount_cents / 100,
      re: e.reimburse ? "✓" : "",
      link: e.receipt_path ? `${appUrl}/boss/tasks/${e.task_id}` : "",
    });
    if (e.receipt_path) row.getCell("link").value = { text: t("expense.viewReceipt"), hyperlink: `${appUrl}/boss/tasks/${e.task_id}` };
  }

  // Blatt 4: Prämien & Abzüge
  const a = wb.addWorksheet(t("adjust.title"));
  a.columns = [
    { header: t("export.date"), key: "date", width: 12 },
    { header: t("export.employee"), key: "emp", width: 24 },
    { header: t("expense.amount"), key: "amount", width: 12, style: { numFmt: euro } },
    { header: t("adjust.reason"), key: "reason", width: 50 },
  ];
  a.getRow(1).font = { bold: true };
  const { data: adj } = await ctx.supabase.from("adjustments").select("*").eq("firm_id", ctx.firm.id).gte("effective_date", period.from).lt("effective_date", period.to);
  for (const r of adj ?? []) a.addRow({ date: r.effective_date, emp: name(r.member_id), amount: r.amount_cents / 100, reason: r.reason });

  const buf = await wb.xlsx.writeBuffer();
  const safeFirm = ctx.firm.name.replace(/[^\p{L}\p{N}_-]+/gu, "_");
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeFirm}_${month}.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
