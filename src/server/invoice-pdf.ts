import "server-only";
import { degrees, rgb } from "pdf-lib";
import type { Invoice, InvoiceItem, Offer, OfferItem, SellerSnapshot } from "@/lib/supabase/types";
import { invoiceTotals, SMALL_BUSINESS_NOTE } from "@/lib/invoice-calc";
import { A4, BLACK, GREY, newPdf, PdfWriter } from "@/lib/pdf";

/** Belege immer auf Deutsch (Rechtsdokument), Beträge de-DE */
const eur = (c: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
const de = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join(".") : "—");
const qtyDe = (q: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(q);

type Doc = {
  title: string; number: string | null; meta: [string, string][]; seller: SellerSnapshot; buyer: string[]; intro?: string | null;
  items: { description: string; qty: number; unit: string; unit_price_cents: number; vat_rate: 0 | 7 | 19 }[]; small: boolean; note?: string | null; payment?: string | null; draft?: boolean;
};

async function render(d: Doc): Promise<Uint8Array> {
  const { pdf, font, bold } = await newPdf();
  const w = new PdfWriter(pdf, font, bold, 56);
  const s = d.seller;
  if (d.draft) w.page.drawText("ENTWURF", { x: 200, y: 420, size: 72, font: bold, color: rgb(0.92, 0.92, 0.92), rotate: degrees(35) });
  // Absenderzeile + Empfänger
  w.text([s.name, s.street, [s.zip, s.city].filter(Boolean).join(" ")].filter(Boolean).join(" · "), { size: 7.5, color: GREY, gap: 4 });
  const top = w.y;
  for (const l of d.buyer.filter(Boolean)) w.text(l, { size: 10.5 });
  // Kopf rechts
  let ry = top;
  for (const [k, v] of d.meta) {
    w.page.drawText(k, { x: A4[0] - 230, y: ry - 9, size: 9, font, color: GREY });
    w.page.drawText(v, { x: A4[0] - 120, y: ry - 9, size: 9, font: bold, color: BLACK });
    ry -= 14;
  }
  w.y = Math.min(w.y, ry) - 28;
  w.text(`${d.title}${d.number ? ` ${d.number}` : ""}`, { size: 16, bold: true, gap: 6 });
  if (d.intro) w.text(d.intro, { size: 10, gap: 8 });
  const t = invoiceTotals(d.items, d.small);
  w.table(
    [{ w: 0.45 }, { w: 4.2 }, { w: 0.9, right: true }, { w: 0.9 }, { w: 1.3, right: true }, { w: 0.7, right: true }, { w: 1.3, right: true }],
    ["Nr.", "Beschreibung", "Menge", "Einheit", "Einzelpreis", "USt", "Netto"],
    t.rows.map((r, i) => [String(i + 1), r.description, qtyDe(r.qty), r.unit, eur(r.unit_price_cents), d.small ? "—" : `${r.vat_rate} %`, eur(r.net)]),
    9,
  );
  w.line();
  const sum: string[][] = [["Summe netto", eur(t.net)]];
  if (!d.small) for (const g of t.groups) sum.push([`zzgl. USt ${g.rate} % auf ${eur(g.net)}`, eur(g.vat)]);
  sum.push(["Gesamtbetrag", eur(t.gross)]);
  w.table([{ w: 5 }, { w: 1.6, right: true }], ["", ""], sum, 10, { boldLast: true });
  if (d.small) w.text(SMALL_BUSINESS_NOTE, { size: 9, gap: 4 });
  if (d.note) w.text(d.note, { size: 9.5, gap: 6 });
  if (d.payment) w.text(d.payment, { size: 9.5, gap: 6 });
  // Fußzeile: Pflichtangaben des Ausstellers
  const foot = [
    [s.name, s.street, [s.zip, s.city].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
    [s.tax_number ? `Steuernummer: ${s.tax_number}` : null, s.vat_id ? `USt-IdNr.: ${s.vat_id}` : null].filter(Boolean).join(" · "),
    [s.bank, s.iban ? `IBAN: ${s.iban}` : null, s.bic ? `BIC: ${s.bic}` : null].filter(Boolean).join(" · "),
    [s.email, s.phone].filter(Boolean).join(" · "),
  ].filter(Boolean);
  for (const p of pdf.getPages()) {
    foot.forEach((line, i) => p.drawText(line.slice(0, 120), { x: 56, y: 24 + (foot.length - 1 - i) * 10, size: 7, font, color: GREY }));
  }
  return pdf.save();
}

export function invoicePdf(inv: Invoice, items: InvoiceItem[], seller: SellerSnapshot, cancelsNumber?: string | null) {
  const sv = inv.service_date_to && inv.service_date_to !== inv.service_date ? `${de(inv.service_date)} – ${de(inv.service_date_to)}` : de(inv.service_date);
  const s = inv.status === "draft" ? seller : inv.seller;
  return render({
    title: inv.kind === "storno" ? "Stornorechnung" : "Rechnung",
    number: inv.number,
    draft: inv.status === "draft",
    meta: [
      ["Rechnungsnummer", inv.number ?? "(Entwurf)"],
      ["Rechnungsdatum", de(inv.issue_date)],
      ["Leistungsdatum", sv],
      ...(inv.kind === "invoice" ? [["Fällig am", de(inv.due_date)] as [string, string]] : []),
      ...(inv.buyer_reference ? [["Ihre Referenz", inv.buyer_reference] as [string, string]] : []),
      ...(inv.buyer_vat_id ? [["USt-IdNr. Kunde", inv.buyer_vat_id] as [string, string]] : []),
    ],
    seller: s,
    buyer: [inv.buyer_name, inv.buyer_street ?? "", [inv.buyer_zip, inv.buyer_city].filter(Boolean).join(" "), inv.buyer_country !== "DE" ? inv.buyer_country : ""],
    intro: inv.kind === "storno" && cancelsNumber ? `Hiermit stornieren wir die Rechnung ${cancelsNumber} vollständig.` : null,
    items: items.map((i) => ({ ...i, qty: Number(i.qty) })),
    small: inv.status === "draft" ? Boolean(seller && (seller as { small?: boolean }).small) : inv.small_business,
    note: inv.note,
    payment: inv.kind === "invoice" && s.iban ? `Bitte überweisen Sie den Betrag bis ${de(inv.due_date)} unter Angabe der Rechnungsnummer auf: ${s.iban}${s.bic ? ` (BIC ${s.bic})` : ""}.` : null,
  });
}

export function offerPdf(off: Offer, items: OfferItem[], seller: SellerSnapshot & { small?: boolean }) {
  return render({
    title: "Angebot",
    number: off.number,
    draft: off.status === "draft",
    meta: [["Angebotsnummer", off.number ?? "(Entwurf)"], ["Datum", de(off.sent_at ?? off.created_at)], ["Gültig bis", de(off.valid_until)]],
    seller,
    buyer: [off.buyer_name, ...(off.buyer_address ?? "").split(/,\s*/)],
    intro: [off.title, off.intro].filter(Boolean).join("\n"),
    items: items.map((i) => ({ ...i, qty: Number(i.qty) })),
    small: off.status === "draft" ? Boolean(seller.small) : off.small_business,
    note: "Wir freuen uns auf Ihren Auftrag. Sie können das Angebot bequem online annehmen.",
  });
}

/** Firmendaten → Verkäufer (für Entwürfe/Angebote) */
export function sellerFromFirm(f: { name: string; legal_name: string | null; address_street: string | null; address_zip: string | null; address_city: string | null; address_country: string; tax_number: string | null; vat_id: string | null; iban: string | null; bic: string | null; bank_name: string | null; invoice_email: string | null; invoice_phone: string | null; small_business: boolean }) {
  return {
    name: f.legal_name || f.name, street: f.address_street, zip: f.address_zip, city: f.address_city, country: f.address_country, tax_number: f.tax_number, vat_id: f.vat_id,
    iban: f.iban, bic: f.bic, bank: f.bank_name, email: f.invoice_email, phone: f.invoice_phone, small: f.small_business,
  };
}
