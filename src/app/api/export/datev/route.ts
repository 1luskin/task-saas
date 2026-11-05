import { NextResponse } from "next/server";
import { AuthError, assertBoss } from "@/lib/auth";
import { isEnabled } from "@/lib/features";
import { todayISO } from "@/lib/dates";
import { buildDatevCsv, encodeCp1252 } from "@/lib/datev";
import { datevBookings } from "@/server/datev-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DATEV Buchungsstapel (EXTF) eines Monats. ?month=YYYY-MM */
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await assertBoss();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 401 });
    throw e;
  }
  if (!(await isEnabled(ctx, "datev"))) return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  const f = ctx.firm;
  if (!f.datev_consultant_no || !f.datev_client_no) return NextResponse.redirect(new URL("/boss/settings#datev", req.url));
  const mp = new URL(req.url).searchParams.get("month");
  const month = mp && /^\d{4}-\d{2}$/.test(mp) ? mp : todayISO().slice(0, 7);
  const { bookings, from, to } = await datevBookings(ctx, month);
  const csv = buildDatevCsv({
    consultantNo: f.datev_consultant_no, clientNo: f.datev_client_no, skr: f.datev_skr,
    fiscalYearStart: `${month.slice(0, 4)}-01-01`, from, to, label: `Buchungen ${month}`,
  }, bookings);
  return new NextResponse(Buffer.from(encodeCp1252(csv)), {
    headers: {
      "Content-Type": "text/csv; charset=windows-1252",
      "Content-Disposition": `attachment; filename="EXTF_Buchungsstapel_${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
