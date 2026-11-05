import { NextResponse } from "next/server";
import { AuthError, assertMember } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { formatDate, formatDuration, monthPeriod, periodToRange, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { loadFinance } from "@/lib/finance";
import { minutesBetween } from "@/lib/dates";
import { shiftNetMinutes } from "@/lib/shifts";
import { isEnabled } from "@/lib/features";
import { GREY, newPdf, PdfWriter, pdfResponse } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Monatsbericht eines Mitarbeiters (PDF): Aufgaben, Stunden, Schichten, Verdienst,
 * Prämien/Abzüge, Nacharbeiten, Ø-Bewertung. ?member=<id>&month=YYYY-MM
 * Chef: jeder Mitarbeiter der Firma; Mitarbeiter: nur sich selbst.
 */
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await assertMember();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 401 });
    throw e;
  }
  if (!(await isEnabled(ctx, "reports"))) return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const isBoss = ctx.member.role === "boss";
  const memberId = isBoss ? sp.get("member") ?? "" : ctx.member.id;
  if (!/^[0-9a-f-]{36}$/.test(memberId)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const mp = sp.get("month");
  const month = mp && /^\d{4}-\d{2}$/.test(mp) ? mp : todayISO().slice(0, 7);
  const { data: member } = await ctx.supabase.from("members").select("*").eq("id", memberId).eq("firm_id", ctx.firm.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const period = monthPeriod(`${month}-01`);
  const { fromTs, toTs } = periodToRange(period);
  const [fin, { data: shifts }, { data: adjustments }] = await Promise.all([
    loadFinance(ctx, period, { memberId }),
    ctx.supabase.from("shifts").select("*").eq("member_id", memberId).gte("ended_at", fromTs).lt("ended_at", toTs).order("started_at"),
    ctx.supabase.from("adjustments").select("*").eq("member_id", memberId).gte("effective_date", period.from).lt("effective_date", period.to).order("effective_date"),
  ]);
  const { t, locale } = await getI18n();
  const money = (c: number) => formatMoney(c, locale);
  const e = fin.perMember.get(memberId);
  const tasks = fin.doneTasks.filter((x) => x.assignee_id === memberId).sort((a, b) => (a.accepted_at ?? "").localeCompare(b.accepted_at ?? ""));
  const minutesOf = (taskId: string) => fin.entries.filter((x) => x.task_id === taskId && x.member_id === memberId).reduce((s, x) => s + minutesBetween(x.started_at, x.ended_at), 0);

  const { pdf, font, bold } = await newPdf();
  const w = new PdfWriter(pdf, font, bold);
  w.text(ctx.firm.name, { size: 10, color: GREY });
  w.text(t("mreport.title", { name: member.full_name }), { size: 18, bold: true });
  w.text(t("mreport.period", { month }), { size: 10, color: GREY, gap: 8 });

  const rating = e && e.ratingCount ? new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "de-DE", { maximumFractionDigits: 1 }).format(e.ratingSum / e.ratingCount) : "—";
  w.table([{ w: 3 }, { w: 2, right: true }], [t("mreport.summary"), ""], [
    [t("money.tasks"), String(e?.tasksDone ?? 0)],
    [t("money.hours"), formatDuration(e?.minutes ?? 0)],
    [t("shift.title"), `${(shifts ?? []).length} · ${formatDuration(e?.shiftMinutes ?? 0)}`],
    [t("export.hourlyPay"), money(e?.hourlyCents ?? 0)],
    [t("export.fixedPay"), money(e?.fixedCents ?? 0)],
    [t("mreport.shiftPay"), money(e?.shiftCents ?? 0)],
    [t("adjust.title"), money(e?.adjustCents ?? 0)],
    [t("expense.reimbursements"), money(e?.reimburseCents ?? 0)],
    [t("export.payout"), money(e?.totalCents ?? 0)],
    [t("mreport.reworks"), String(e?.reworks ?? 0)],
    [t("mreport.rating"), rating],
  ]);
  w.line();

  w.text(t("mreport.tasks"), { size: 12, bold: true, gap: 2 });
  if (tasks.length) {
    w.table([{ w: 1.3 }, { w: 4 }, { w: 1, right: true }, { w: 1.4, right: true }, { w: 0.9, right: true }, { w: 0.9, right: true }],
      [t("mreport.accepted"), t("task.title"), t("money.hours"), t("export.fixedPay"), t("mreport.rating"), t("mreport.reworks")],
      tasks.map((x) => [
        x.accepted_at ? formatDate(x.accepted_at.slice(0, 10), locale) : "—", x.title, formatDuration(minutesOf(x.id)),
        x.fixed_pay_cents ? money(x.fixed_pay_cents) : "—", x.rating ? String(x.rating) : "—", String(x.rework_count ?? 0),
      ]));
  } else w.text("—", { color: GREY, gap: 6 });

  if ((shifts ?? []).length) {
    w.text(t("shift.title"), { size: 12, bold: true, gap: 2 });
    w.table([{ w: 1.5 }, { w: 2 }, { w: 1, right: true }],
      [t("team.date"), t("mreport.time"), t("money.hours")],
      shifts!.map((s) => [
        formatDate(s.started_at.slice(0, 10), locale),
        `${new Date(s.started_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}–${s.ended_at ? new Date(s.ended_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : ""}${s.auto_closed ? " (auto)" : ""}`,
        formatDuration(shiftNetMinutes(s)),
      ]));
  }
  if ((adjustments ?? []).length) {
    w.text(t("adjust.title"), { size: 12, bold: true, gap: 2 });
    w.table([{ w: 1.3 }, { w: 4 }, { w: 1.4, right: true }], [t("team.date"), t("mreport.reason"), t("mreport.amount")],
      adjustments!.map((a) => [formatDate(a.effective_date, locale), a.reason, money(a.amount_cents)]));
  }
  w.line();
  w.text(t("mreport.footer", { date: formatDate(todayISO(), locale) }), { size: 8, color: GREY });
  return pdfResponse(await pdf.save(), `${member.full_name}_${month}.pdf`);
}
