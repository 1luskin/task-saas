import { NextResponse } from "next/server";
import { invoiceCtx } from "@/server/invoice-access";
import { buildXRechnung } from "@/lib/xrechnung";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** XRechnung 3.0 (CII) – nur für ausgestellte Rechnungen */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await invoiceCtx(id);
  if (ctx instanceof NextResponse) return ctx;
  const { data: inv } = await ctx.supabase.from("invoices").select("*").eq("id", id).eq("firm_id", ctx.firm.id).maybeSingle();
  if (!inv || inv.status === "draft") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: items } = await ctx.supabase.from("invoice_items").select("*").eq("invoice_id", id).order("position");
  const { data: orig } = inv.cancels_id ? await ctx.supabase.from("invoices").select("number").eq("id", inv.cancels_id).maybeSingle() : { data: null };
  return new NextResponse(buildXRechnung(inv, items ?? [], orig?.number), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${(inv.number ?? "rechnung").replace(/[^\w.-]/g, "_")}.xml"`, "Cache-Control": "no-store" },
  });
}
