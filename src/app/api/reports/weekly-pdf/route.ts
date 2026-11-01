import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { AuthError, assertBoss } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { addDays, formatDate, formatDuration, todayISO, weekPeriod } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { buildPeriodReport } from "@/server/month-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCENT = rgb(0x4a / 255, 0x63 / 255, 0x78 / 255);
const MUTED = rgb(0.42, 0.45, 0.49);
const TEXT = rgb(0.13, 0.15, 0.17);
const LINE = rgb(0.85, 0.86, 0.88);

/** Wochenbericht als PDF. ?week=YYYY-MM-DD (beliebiger Tag der Woche) */
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await assertBoss();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 401 });
    throw e;
  }
  const { t, locale } = await getI18n();
  const wp = new URL(req.url).searchParams.get("week");
  const period = weekPeriod(wp && /^\d{4}-\d{2}-\d{2}$/.test(wp) ? wp : todayISO());
  const { fin, rows, memberById } = await buildPeriodReport(ctx, period);
  const name = (id: string | null) => (id ? memberById.get(id)?.full_name ?? "?" : "—");
  const money = (c: number) => formatMoney(c, locale);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontDir = path.join(process.cwd(), "assets", "fonts");
  const regular = await pdf.embedFont(await readFile(path.join(fontDir, "Inter_400Regular.ttf")), { subset: true });
  const bold = await pdf.embedFont(await readFile(path.join(fontDir, "Inter_700Bold.ttf")), { subset: true });

  const W = 595.28, H = 841.89, M = 48; // A4
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const ensure = (h: number) => {
    if (y - h < M) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };
  const fit = (s: string, f: PDFFont, size: number, max: number) => {
    if (f.widthOfTextAtSize(s, size) <= max) return s;
    let out = s;
    while (out.length > 1 && f.widthOfTextAtSize(out + "…", size) > max) out = out.slice(0, -1);
    return out + "…";
  };
  const text = (s: string, x: number, opts: { f?: PDFFont; size?: number; color?: typeof TEXT; max?: number; right?: boolean } = {}) => {
    const f = opts.f ?? regular, size = opts.size ?? 10;
    const str = opts.max ? fit(s, f, size, opts.max) : s;
    const dx = opts.right ? -f.widthOfTextAtSize(str, size) : 0;
    page.drawText(str, { x: x + dx, y, size, font: f, color: opts.color ?? TEXT });
  };
  const hr = () => page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.5, color: LINE });

  // Kopf
  text(ctx.firm.name, M, { f: bold, size: 18 });
  y -= 22;
  text(`${t("reports.pdfTitle")} · ${formatDate(period.from, locale)} – ${formatDate(addDays(period.to, -1), locale)}`, M, { size: 11, color: MUTED });
  y -= 30;

  // Kennzahlen
  const kpis: [string, string][] = [
    [t("money.revenue"), money(fin.revenueCents)],
    [t("money.payouts"), money(fin.payoutCents)],
    [t("money.profit"), money(fin.profitCents)],
    [t("money.tasks"), String(fin.doneTasks.length)],
  ];
  const kw = (W - 2 * M) / kpis.length;
  kpis.forEach(([label, value], i) => {
    page.drawRectangle({ x: M + i * kw + 2, y: y - 30, width: kw - 4, height: 46, color: rgb(0.965, 0.969, 0.973), borderColor: LINE, borderWidth: 0.5 });
    const yy = y;
    text(label, M + i * kw + 12, { size: 8, color: MUTED });
    y -= 18;
    text(value, M + i * kw + 12, { f: bold, size: 13, color: i === 2 ? ACCENT : TEXT });
    y = yy;
  });
  y -= 60;

  // Pro Mitarbeiter
  text(t("money.perEmployee"), M, { f: bold, size: 12 });
  y -= 18;
  const c1 = [M, M + 230, M + 310, M + 400, W - M];
  text(t("export.employee"), c1[0]!, { size: 8, color: MUTED });
  text(t("employees.tasksDone"), c1[2]!, { size: 8, color: MUTED, right: true });
  text(t("export.hours"), c1[3]!, { size: 8, color: MUTED, right: true });
  text(t("export.payout"), c1[4]!, { size: 8, color: MUTED, right: true });
  y -= 14;
  for (const m of [...fin.perMember.values()].sort((a, b) => b.totalCents - a.totalCents)) {
    ensure(16);
    hr();
    text(name(m.memberId), c1[0]!, { max: 220 });
    text(String(m.tasksDone), c1[2]!, { right: true });
    text(formatDuration(m.minutes), c1[3]!, { right: true });
    text(money(m.totalCents), c1[4]!, { right: true });
    y -= 16;
  }
  y -= 20;

  // Aufgaben
  ensure(40);
  text(t("export.sheetTasks"), M, { f: bold, size: 12 });
  y -= 18;
  const c2 = [M, M + 60, M + 250, M + 410, M + 480, W - M];
  const heads = [t("export.date"), t("export.task"), t("export.employee"), t("export.payout"), t("export.clientPrice"), t("export.profit")];
  heads.forEach((h, i) => text(h, c2[i]!, { size: 8, color: MUTED, right: i >= 3 }));
  y -= 14;
  for (const r of rows) {
    ensure(16);
    hr();
    text(r.date ? formatDate(r.date.slice(0, 10), locale, { day: "2-digit", month: "2-digit" }) : "", c2[0]!, { size: 9 });
    text(r.title, c2[1]!, { size: 9, max: 180 });
    text(name(r.memberId), c2[2]!, { size: 9, max: 100 });
    text(money(r.payoutCents), c2[3]!, { size: 9, right: true });
    text(money(r.clientPriceCents), c2[4]!, { size: 9, right: true });
    text(money(r.profitCents), c2[5]!, { size: 9, right: true, color: r.profitCents < 0 ? rgb(0.62, 0.23, 0.22) : TEXT });
    y -= 16;
  }

  // Fußzeile
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`${ctx.firm.name} · ${i + 1}/${pages.length}`, { x: M, y: 24, size: 8, font: regular, color: MUTED });
  });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report_${period.from}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
