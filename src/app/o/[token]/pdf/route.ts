import { NextResponse } from "next/server";
import { loadPublicOffer } from "@/server/offer-public";
import { offerPdf, sellerFromFirm } from "@/server/invoice-pdf";
import { pdfResponse } from "@/lib/pdf";
import { hit, clientIpHash } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await hit("publicLink", `offer-pdf:${await clientIpHash()}`))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const r = await loadPublicOffer(token);
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return pdfResponse(await offerPdf(r.off, r.items, sellerFromFirm(r.firm)), `${r.off.number}.pdf`);
}
