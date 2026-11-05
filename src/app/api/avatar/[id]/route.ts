import { NextResponse } from "next/server";
import { AuthError, assertMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { isDemo } from "@/lib/demo/mode";

export const runtime = "nodejs";

/** Profilfoto eines Mitglieds – nur für angemeldete Mitglieder derselben Firma */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await assertMember();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: 403 });
    throw e;
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id) || isDemo()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const admin = createAdminClient();
  const { data: m } = await admin.from("members").select("firm_id, avatar_path").eq("id", id).maybeSingle();
  if (!m || m.firm_id !== ctx.firm.id || !m.avatar_path) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: blob } = await admin.storage.from("avatars").download(m.avatar_path);
  if (!blob) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(Buffer.from(await blob.arrayBuffer()), {
    headers: { "Content-Type": blob.type || "image/jpeg", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}
