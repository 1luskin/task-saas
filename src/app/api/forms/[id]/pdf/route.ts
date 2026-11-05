import { NextResponse } from "next/server";
import { AuthError, assertMember } from "@/lib/auth";
import { isEnabled } from "@/lib/features";
import { getI18n } from "@/i18n/server";
import { formatDate, formatDateTime } from "@/lib/dates";
import { GREY, newPdf, PdfWriter, pdfResponse } from "@/lib/pdf";

export const runtime = "nodejs";

/** Ausgefülltes Formular (z. B. Abnahmeprotokoll) als PDF – RLS: nur wer die Aufgabe sieht */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await assertMember();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: 403 });
    throw e;
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!(await isEnabled(ctx, "knowledge"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data: sub } = await ctx.supabase.from("form_submissions").select("*").eq("id", id).maybeSingle();
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [{ data: tpl }, { data: task }, { data: who }] = await Promise.all([
    ctx.supabase.from("form_templates").select("*").eq("id", sub.template_id).maybeSingle(),
    ctx.supabase.from("tasks").select("id,title,address,due_date").eq("id", sub.task_id).maybeSingle(),
    sub.submitted_by ? ctx.supabase.from("members").select("full_name").eq("id", sub.submitted_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!tpl || !task) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { t, locale } = await getI18n();

  const { pdf, font, bold } = await newPdf();
  const w = new PdfWriter(pdf, font, bold);
  w.text(ctx.firm.name, { size: 10, color: GREY });
  w.text(tpl.name, { size: 18, bold: true, gap: 4 });
  w.text(`${task.title}${task.address ? ` · ${task.address}` : ""}`, { size: 11 });
  w.text(`${formatDateTime(sub.created_at, locale)}${who?.full_name ? ` · ${who.full_name}` : ""}`, { size: 9, color: GREY, gap: 6 });
  w.line();
  const vals = sub.values as Record<string, unknown>;
  for (const f of tpl.fields) {
    const v = vals[f.id];
    w.text(f.label, { size: 9, color: GREY });
    if (f.type === "photo" && typeof v === "string") {
      try {
        const { data: blob } = await ctx.supabase.storage.from("task-files").download(v);
        if (blob) {
          const img = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()));
          const scale = Math.min(1, w.width / img.width, 260 / img.height);
          w.ensure(img.height * scale + 8);
          w.page.drawImage(img, { x: w.margin, y: w.y - img.height * scale, width: img.width * scale, height: img.height * scale });
          w.y -= img.height * scale + 10;
          continue;
        }
      } catch { /* Bild nicht verfügbar */ }
      w.text("—", { size: 11, gap: 6 });
      continue;
    }
    const text = v === undefined || v === null || v === "" ? "—" : typeof v === "boolean" ? (v ? t("common.yes") : t("common.no")) : String(v);
    w.text(text, { size: 11, gap: 6 });
  }
  w.line();
  w.text(`${t("kb.pdf")} · ${formatDate(sub.created_at.slice(0, 10), locale)}`, { size: 8, color: GREY });
  return pdfResponse(await pdf.save(), `${tpl.name}_${task.title}.pdf`.slice(0, 80));
}
