import "server-only";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const A4: [number, number] = [595.28, 841.89];
export const GREY = rgb(0.38, 0.38, 0.38);
export const BLACK = rgb(0.1, 0.1, 0.1);

/** PDF mit Golos Text (Text) + Geologica (Überschriften), Untermenge eingebettet */
export async function newPdf() {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const dir = path.join(process.cwd(), "assets", "fonts");
  const font = await pdf.embedFont(await readFile(path.join(dir, "GolosText-Regular.ttf")), { subset: true });
  const bold = await pdf.embedFont(await readFile(path.join(dir, "Geologica-SemiBold.ttf")), { subset: true });
  return { pdf, font, bold };
}

/** Zeilenumbruch nach Breite (Wörter; überlange Wörter werden hart getrennt) */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
        if (line) { out.push(line); line = ""; }
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > maxWidth) { out.push(line); line = w; } else line = next;
    }
    out.push(line);
  }
  return out;
}

/** Einfacher Fließtext-Schreiber mit automatischem Seitenumbruch */
export class PdfWriter {
  page: PDFPage;
  y: number;
  constructor(private doc: PDFDocument, public font: PDFFont, public bold: PDFFont, public margin = 48) {
    this.page = doc.addPage(A4);
    this.y = A4[1] - margin;
  }
  ensure(h: number) {
    if (this.y - h < this.margin) {
      this.page = this.doc.addPage(A4);
      this.y = A4[1] - this.margin;
    }
  }
  get width() { return A4[0] - this.margin * 2; }
  text(s: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const f = opts.bold ? this.bold : this.font;
    for (const line of wrapText(s, f, size, this.width - (opts.indent ?? 0))) {
      this.ensure(size * 1.45);
      this.page.drawText(line, { x: this.margin + (opts.indent ?? 0), y: this.y - size, size, font: f, color: opts.color ?? BLACK });
      this.y -= size * 1.45;
    }
    this.y -= opts.gap ?? 0;
  }
  /** Tabelle: Spaltenbreiten in Anteilen, Zahlen rechtsbündig, Text wird umbrochen (nichts abgeschnitten); Kopfzeile grau-fett */
  table(cols: { w: number; right?: boolean }[], head: string[], rows: string[][], size = 9, opts: { boldLast?: boolean } = {}) {
    const total = cols.reduce((a, c) => a + c.w, 0);
    const xs: number[] = [];
    let x = this.margin;
    for (const c of cols) { xs.push(x); x += (c.w / total) * this.width; }
    const widths = cols.map((c) => (c.w / total) * this.width - 6);
    const lineH = size * 1.35;
    const draw = (cells: string[], f: PDFFont, color = BLACK) => {
      const wrapped = cells.map((c, i) => wrapText(c, f, size, widths[i]!));
      const h = Math.max(1, ...wrapped.map((w) => w.length)) * lineH + size * 0.35;
      this.ensure(h);
      wrapped.forEach((lines, i) => lines.forEach((txt, li) => {
        const w = f.widthOfTextAtSize(txt, size);
        const cx = cols[i]!.right ? xs[i]! + widths[i]! - w : xs[i]!;
        this.page.drawText(txt, { x: cx, y: this.y - size - li * lineH, size, font: f, color });
      }));
      this.y -= h;
    };
    if (head.some(Boolean)) draw(head, this.bold, GREY);
    rows.forEach((r, i) => draw(r, opts.boldLast && i === rows.length - 1 ? this.bold : this.font));
    this.y -= 6;
  }
  line() {
    this.ensure(10);
    this.page.drawLine({ start: { x: this.margin, y: this.y - 4 }, end: { x: A4[0] - this.margin, y: this.y - 4 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    this.y -= 12;
  }
}

export function pdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`, "Cache-Control": "no-store" },
  });
}
