import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AuthError, assertBoss } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { getI18n } from "@/i18n/server";

export const runtime = "nodejs";

/** QR-Aufkleber (A6) für ein Objekt/einen Kunden zum Ausdrucken */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await assertBoss();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: 403 });
    throw e;
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data: client } = await ctx.supabase.from("clients").select("id, name, address").eq("id", id).eq("firm_id", ctx.firm.id).maybeSingle();
  if (!client) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { t } = await getI18n();
  const url = `${serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/q/c/${client.id}`;
  const png = await QRCode.toBuffer(url, { errorCorrectionLevel: "M", margin: 1, width: 600, color: { dark: "#000000", light: "#FFFFFF" } });

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const dir = path.join(process.cwd(), "assets", "fonts");
  const font = await pdf.embedFont(await readFile(path.join(dir, "GolosText-Regular.ttf")), { subset: true });
  const bold = await pdf.embedFont(await readFile(path.join(dir, "Geologica-SemiBold.ttf")), { subset: true });
  const page = pdf.addPage([297.64, 419.53]); // A6
  const img = await pdf.embedPng(png);
  page.drawText(ctx.firm.name, { x: 24, y: 385, size: 13, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawImage(img, { x: 38, y: 120, width: 222, height: 222 });
  page.drawText(client.name.slice(0, 40), { x: 24, y: 95, size: 14, font: bold });
  if (client.address) page.drawText(client.address.slice(0, 55), { x: 24, y: 76, size: 9, font });
  page.drawText(t("qr.scanHint"), { x: 24, y: 40, size: 8, font, color: rgb(0.35, 0.35, 0.35), maxWidth: 250 });
  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="qr_${client.id.slice(0, 8)}.pdf"`, "Cache-Control": "no-store" },
  });
}
