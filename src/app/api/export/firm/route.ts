import { NextResponse } from "next/server";
import { zipSync, strToU8 } from "fflate";
import { AuthError, assertBoss, requireRecentAuth } from "@/lib/auth";
import { APP_NAME } from "@/config/app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TABLES = [
  "groups", "members", "tasks", "task_finance", "task_statuses", "checklist_items", "task_comments", "task_photos",
  "time_entries", "task_requests", "task_templates", "data_requests",
] as const;

/** DSGVO-Export: alle Daten der Firma als ZIP (JSON je Tabelle + Fotos). Nur Chef, mit frischer Code-Bestätigung. */
export async function GET() {
  let ctx;
  try {
    ctx = await assertBoss();
    await requireRecentAuth(ctx, 15);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.code === "reauth" ? 401 : 403 });
    throw e;
  }
  const files: Record<string, Uint8Array> = {};
  const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2));
  files["firm.json"] = json(ctx.firm);
  for (const t of TABLES) {
    // RLS + firm_id: ausschließlich Daten der eigenen Firma
    const { data } = await ctx.supabase.from(t).select("*").eq("firm_id", ctx.firm.id);
    files[`${t}.json`] = json(data ?? []);
  }
  const { data: invites } = await ctx.supabase.from("invites").select("id, role, group_id, expires_at, used_count, revoked, created_at").eq("firm_id", ctx.firm.id);
  files["invites.json"] = json(invites ?? []); // ohne Token (Geheimnis)

  // Fotos (max. 300 Stück)
  const { data: photos } = await ctx.supabase.from("task_photos").select("storage_path").eq("firm_id", ctx.firm.id).limit(300);
  for (const p of photos ?? []) {
    const { data } = await ctx.supabase.storage.from("task-photos").download(p.storage_path);
    if (data) files[`photos/${p.storage_path.replace(/[^a-zA-Z0-9/._-]/g, "_")}`] = new Uint8Array(await data.arrayBuffer());
  }
  files["README.txt"] = strToU8(`${APP_NAME} – Datenexport\nFirma: ${ctx.firm.name}\nErstellt: ${new Date().toISOString()}\nBeträge in Cent, Zeiten in UTC.\n`);

  const zip = zipSync(files, { level: 6 });
  const name = `${ctx.firm.name.replace(/[^\p{L}\p{N}_-]+/gu, "_")}_export_${new Date().toISOString().slice(0, 10)}.zip`;
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
