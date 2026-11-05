import "server-only";
import { NextResponse } from "next/server";
import { AuthError, assertBoss, type Ctx } from "@/lib/auth";
import { isEnabled } from "@/lib/features";

/** Chef + Feature "invoices" für Beleg-Downloads; sonst passende HTTP-Antwort */
export async function invoiceCtx(id: string): Promise<Ctx | NextResponse> {
  let ctx;
  try {
    ctx = await assertBoss();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 401 });
    throw e;
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!(await isEnabled(ctx, "invoices"))) return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  return ctx;
}
