import { NextResponse } from "next/server";
import { invoiceCtx } from "@/server/invoice-access";
import { offerPdf, sellerFromFirm } from "@/server/invoice-pdf";
import { pdfResponse } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await invoiceCtx(id);
  if (ctx instanceof NextResponse) return ctx;
  const { data: off } = await ctx.supabase.from("offers").select("*").eq("id", id).eq("firm_id", ctx.firm.id).maybeSingle();
  if (!off) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: items } = await ctx.supabase.from("offer_items").select("*").eq("offer_id", id).order("position");
  return pdfResponse(await offerPdf(off, items ?? [], sellerFromFirm(ctx.firm)), `${off.number ?? "Angebot-Entwurf"}.pdf`);
}
