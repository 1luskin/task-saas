/**
 * XRechnung 3.0 in CII-Syntax (UN/CEFACT Cross Industry Invoice, EN 16931).
 * Wird als separate XML-Datei neben dem PDF bereitgestellt (siehe DECISIONS.md).
 */
import type { Invoice, InvoiceItem, SellerSnapshot } from "./supabase/types";
import { invoiceTotals } from "./invoice-calc";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const amt = (cents: number) => (cents / 100).toFixed(2);
const d8 = (iso: string) => iso.replace(/-/g, "").slice(0, 8);
const qtyFmt = (q: number) => Number(q).toFixed(3).replace(/\.?0+$/, "") || "0";
/** UN/ECE Rec 20 Einheitencodes für gängige Einheiten */
export function unitCode(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  if (["h", "std", "stunde", "stunden", "ч", "час"].includes(u)) return "HUR";
  if (["m²", "m2", "qm"].includes(u)) return "MTK";
  if (["m", "lfm"].includes(u)) return "MTR";
  if (["kg"].includes(u)) return "KGM";
  if (["l", "liter"].includes(u)) return "LTR";
  if (["tag", "tage", "день"].includes(u)) return "DAY";
  if (["pausch", "pauschal", "psch"].includes(u)) return "LS";
  return "C62"; // Stück / Einheit
}

export function buildXRechnung(inv: Invoice, items: InvoiceItem[], cancelsNumber?: string | null): string {
  const s: SellerSnapshot = inv.seller ?? {};
  const t = invoiceTotals(items.map((i) => ({ ...i, qty: Number(i.qty) })), inv.small_business);
  const typeCode = inv.kind === "storno" ? "381" : "380"; // 381 = Gutschrift/Korrektur, 380 = Rechnung
  const cat = (rate: number) => (inv.small_business ? "E" : rate === 0 ? "Z" : "S");
  const lines = t.rows.map((r, i) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${esc(r.description)}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${amt(r.unit_price_cents)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${unitCode(r.unit)}">${qtyFmt(r.qty)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat(r.vat_rate)}</ram:CategoryCode><ram:RateApplicablePercent>${inv.small_business ? 0 : r.vat_rate}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amt(r.net)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join("");
  const taxes = t.groups.map((g) => `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${amt(g.vat)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>
        ${inv.small_business ? "<ram:ExemptionReason>Kleinunternehmer gemäß § 19 UStG</ram:ExemptionReason>" : ""}
        <ram:BasisAmount>${amt(g.net)}</ram:BasisAmount><ram:CategoryCode>${cat(g.rate)}</ram:CategoryCode><ram:RateApplicablePercent>${inv.small_business ? 0 : g.rate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`).join("");
  const sellerTax = [
    s.vat_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(s.vat_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : "",
    s.tax_number ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(s.tax_number)}</ram:ID></ram:SpecifiedTaxRegistration>` : "",
  ].join("");
  const notes = [inv.note, inv.small_business ? "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet." : null].filter(Boolean) as string[];
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(inv.number ?? "")}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${d8(inv.issue_date ?? "")}</udt:DateTimeString></ram:IssueDateTime>${notes.map((n) => `
    <ram:IncludedNote><ram:Content>${esc(n)}</ram:Content></ram:IncludedNote>`).join("")}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lines}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${esc(inv.buyer_reference || inv.number || "")}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${esc(s.name ?? "")}</ram:Name>
        <ram:DefinedTradeContact>
          <ram:PersonName>${esc(s.name ?? "")}</ram:PersonName>
          <ram:TelephoneUniversalCommunication><ram:CompleteNumber>${esc(s.phone ?? "-")}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>
          <ram:EmailURIUniversalCommunication><ram:URIID>${esc(s.email ?? "-")}</ram:URIID></ram:EmailURIUniversalCommunication>
        </ram:DefinedTradeContact>
        <ram:PostalTradeAddress><ram:PostcodeCode>${esc(s.zip ?? "")}</ram:PostcodeCode><ram:LineOne>${esc(s.street ?? "")}</ram:LineOne><ram:CityName>${esc(s.city ?? "")}</ram:CityName><ram:CountryID>${esc(s.country ?? "DE")}</ram:CountryID></ram:PostalTradeAddress>
        ${s.email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(s.email)}</ram:URIID></ram:URIUniversalCommunication>` : ""}
        ${sellerTax}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(inv.buyer_name)}</ram:Name>
        <ram:PostalTradeAddress><ram:PostcodeCode>${esc(inv.buyer_zip ?? "")}</ram:PostcodeCode><ram:LineOne>${esc(inv.buyer_street ?? "")}</ram:LineOne><ram:CityName>${esc(inv.buyer_city ?? "")}</ram:CityName><ram:CountryID>${esc(inv.buyer_country)}</ram:CountryID></ram:PostalTradeAddress>
        ${inv.buyer_email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(inv.buyer_email)}</ram:URIID></ram:URIUniversalCommunication>` : ""}
        ${inv.buyer_vat_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(inv.buyer_vat_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${d8(inv.service_date ?? inv.issue_date ?? "")}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      ${s.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${esc(s.iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>${s.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${esc(s.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>` : ""}</ram:SpecifiedTradeSettlementPaymentMeans>` : `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>1</ram:TypeCode></ram:SpecifiedTradeSettlementPaymentMeans>`}${taxes}
      ${inv.service_date && inv.service_date_to ? `<ram:BillingSpecifiedPeriod><ram:StartDateTime><udt:DateTimeString format="102">${d8(inv.service_date)}</udt:DateTimeString></ram:StartDateTime><ram:EndDateTime><udt:DateTimeString format="102">${d8(inv.service_date_to)}</udt:DateTimeString></ram:EndDateTime></ram:BillingSpecifiedPeriod>` : ""}
      <ram:SpecifiedTradePaymentTerms>${inv.due_date ? `<ram:Description>Zahlbar bis ${inv.due_date.split("-").reverse().join(".")}</ram:Description><ram:DueDateDateTime><udt:DateTimeString format="102">${d8(inv.due_date)}</udt:DateTimeString></ram:DueDateDateTime>` : "<ram:Description>Sofort zahlbar</ram:Description>"}</ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amt(t.net)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${amt(t.net)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${amt(t.vat)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amt(t.gross)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${amt(inv.status === "paid" ? 0 : t.gross)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>${cancelsNumber ? `
      <ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${esc(cancelsNumber)}</ram:IssuerAssignedID></ram:InvoiceReferencedDocument>` : ""}
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}
