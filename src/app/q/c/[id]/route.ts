import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";

/** Ziel des QR-Aufklebers: Chef → Kundenkarte, Mitarbeiter → eigene Aufgaben bei diesem Objekt */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = new URL(req.url);
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.redirect(new URL("/", base));
  const ctx = await getContext();
  if (!ctx || !ctx.member) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/q/c/${id}`)}`, base));
  return NextResponse.redirect(new URL(ctx.member.role === "boss" ? `/boss/clients/${id}` : `/staff/scan?client=${id}`, base));
}
