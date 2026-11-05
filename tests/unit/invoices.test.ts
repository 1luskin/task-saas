import { describe, expect, it } from "vitest";
import { formatDocNo, invoiceTotals, isInvoiceOverdue, roundHalfAway } from "@/lib/invoice-calc";
import { buildXRechnung, unitCode } from "@/lib/xrechnung";
import type { Invoice, InvoiceItem } from "@/lib/supabase/types";

describe("Rechnung: Summen wie in der DB", () => {
  it("Netto je Zeile, Steuer je Satz gerundet (Beispiel aus dem SQL-Test)", () => {
    const t = invoiceTotals([
      { description: "Reinigung", qty: 2, unit: "Stk", unit_price_cents: 10050, vat_rate: 19 },
      { description: "Buch", qty: 1, unit: "Stk", unit_price_cents: 1000, vat_rate: 7 },
    ], false);
    expect([t.net, t.vat, t.gross]).toEqual([21100, 3889, 24989]);
    expect(t.groups).toEqual([{ rate: 19, net: 20100, vat: 3819 }, { rate: 7, net: 1000, vat: 70 }]);
  });
  it("Kleinunternehmer: keine Steuer; Storno negativ symmetrisch gerundet", () => {
    expect(invoiceTotals([{ description: "x", qty: 1.5, unit: "h", unit_price_cents: 3333, vat_rate: 19 }], true)).toMatchObject({ net: 5000, vat: 0, gross: 5000 });
    expect(roundHalfAway(-2.5)).toBe(-3);
    expect(roundHalfAway(2.5)).toBe(3);
    const s = invoiceTotals([{ description: "x", qty: -2, unit: "Stk", unit_price_cents: 10050, vat_rate: 19 }], false);
    expect([s.net, s.vat]).toEqual([-20100, -3819]);
  });
  it("Nummernformat und Überfälligkeit", () => {
    expect(formatDocNo("RE", 2026, 7)).toBe("RE-2026-0007");
    expect(isInvoiceOverdue({ status: "sent", due_date: "2026-11-01" }, "2026-11-05")).toBe(true);
    expect(isInvoiceOverdue({ status: "paid", due_date: "2026-11-01" }, "2026-11-05")).toBe(false);
  });
});

describe("XRechnung (CII)", () => {
  const inv = {
    id: "i", firm_id: "f", kind: "invoice", number: "RE-2026-0001", status: "sent", client_id: null, task_id: null, offer_id: null, cancels_id: null,
    issue_date: "2026-11-05", service_date: "2026-11-04", service_date_to: null, due_date: "2026-11-19",
    buyer_name: "Kunde & Co", buyer_street: "Weg 1", buyer_zip: "10115", buyer_city: "Berlin", buyer_country: "DE", buyer_vat_id: null, buyer_email: null, buyer_reference: null,
    seller: { name: "Firma GmbH", street: "Str 1", zip: "10115", city: "Berlin", country: "DE", tax_number: "12/345/67890", iban: "DE02120300000000202051", email: "r@f.de", phone: "030 1" },
    small_business: false, note: null, net_cents: 21100, vat_cents: 3889, gross_cents: 24989, sent_at: null, paid_at: null, retain_until: null, created_by: null, created_at: "", updated_at: "",
  } as Invoice;
  const items = [
    { id: "1", invoice_id: "i", position: 0, description: "Reinigung <Haus>", qty: 2, unit: "h", unit_price_cents: 10050, vat_rate: 19 },
    { id: "2", invoice_id: "i", position: 1, description: "Buch", qty: 1, unit: "Stk", unit_price_cents: 1000, vat_rate: 7 },
  ] as InvoiceItem[];
  const xml = buildXRechnung(inv, items);
  it("enthält Pflichtangaben und korrekte Summen, escaped Text", () => {
    expect(xml).toContain("urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0");
    expect(xml).toContain("<ram:ID>RE-2026-0001</ram:ID>");
    expect(xml).toContain("<ram:TypeCode>380</ram:TypeCode>");
    expect(xml).toContain("<ram:GrandTotalAmount>249.89</ram:GrandTotalAmount>");
    expect(xml).toContain("<ram:TaxTotalAmount currencyID=\"EUR\">38.89</ram:TaxTotalAmount>");
    expect(xml).toContain("Kunde &amp; Co");
    expect(xml).toContain("Reinigung &lt;Haus&gt;");
    expect(xml).toContain('<ram:BilledQuantity unitCode="HUR">2</ram:BilledQuantity>');
    expect(xml).toContain('<ram:ID schemeID="FC">12/345/67890</ram:ID>');
    expect(xml).toContain("<ram:IBANID>DE02120300000000202051</ram:IBANID>");
  });
  it("Einheitencodes", () => {
    expect(unitCode("Std.")).toBe("HUR");
    expect(unitCode("m²")).toBe("MTK");
    expect(unitCode("Pausch.")).toBe("LS");
    expect(unitCode("Sack")).toBe("C62");
  });
});
