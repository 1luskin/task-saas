import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { AuthError, assertBoss } from "@/lib/auth";
import { getI18n } from "@/i18n/server";

export const runtime = "nodejs";

/** Excel-Vorlage für den Mitarbeiter-Import */
export async function GET() {
  try {
    await assertBoss();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: 403 });
    throw e;
  }
  const { t } = await getI18n();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(t("imp.sheet"));
  ws.columns = [
    { header: t("imp.c_name"), width: 26 },
    { header: t("imp.c_email"), width: 28 },
    { header: t("imp.c_phone"), width: 18 },
    { header: t("imp.c_group"), width: 16 },
    { header: t("imp.c_rate"), width: 16 },
    { header: t("imp.c_vacation"), width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow(["Max Mustermann", "max@example.de", "+49 171 0000000", "Team A", "18,50", 28]);
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="mitarbeiter-import.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
