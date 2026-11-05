/**
 * DATEV-Format "Buchungsstapel" (EXTF, Version 700, Formatversion 13), Zeichensatz Windows-1252, CRLF.
 * Erste Zeile: Kopf (31 Felder), zweite: Spaltenüberschriften, dann Buchungen.
 * Wir befüllen die ersten 14 Spalten (Umsatz … Buchungstext); weitere Spalten sind optional.
 */
import type { DatevAccounts } from "./supabase/types";

export type Skr = "03" | "04";
export interface DatevHeader {
  consultantNo: number; clientNo: number; skr: Skr; fiscalYearStart: string; // YYYY-MM-DD
  from: string; to: string; // inkl. YYYY-MM-DD
  label: string; createdAt?: Date; accountLength?: number;
}
export interface Booking {
  amountCents: number; // brutto, > 0
  side: "S" | "H"; // bezogen auf "konto"
  account: number; contraAccount: number; buKey?: string;
  date: string; // YYYY-MM-DD
  docNo: string; text: string;
}

/** Standardkonten je Kontenrahmen (Steuerberater sollte prüfen; überschreibbar je Firma) */
export const DEFAULT_ACCOUNTS: Record<Skr, Required<DatevAccounts> & { revenue19: number; revenue7: number; revenue0: number; revenueSmall: number }> = {
  // Debitor (Sammel-Personenkonto), Kasse, sonstiger Betriebsbedarf, Wareneingang, Erlöse 19 % / 7 % / steuerfrei / Kleinunternehmer
  "03": { debitor: 10000, cash: 1000, expense: 4980, material: 3400, revenue19: 8400, revenue7: 8300, revenue0: 8120, revenueSmall: 8195 },
  "04": { debitor: 10000, cash: 1600, expense: 6850, material: 5400, revenue19: 4400, revenue7: 4300, revenue0: 4120, revenueSmall: 4185 },
};
/** BU-Schlüssel Vorsteuer 19 % / 7 % */
export const BU_VST = { 19: "9", 7: "8", 0: "" } as const;

export const DATEV_COLUMNS = [
  "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz",
  "Konto", "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext",
];

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const ymd = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const stamp = (d: Date) => d.toISOString().replace(/[-:TZ.]/g, "").slice(0, 17); // YYYYMMDDHHMMSSmmm
export const datevAmount = (cents: number) => (Math.abs(cents) / 100).toFixed(2).replace(".", ",");
/** Belegfeld 1: max. 36 Zeichen, erlaubt A–Z 0–9 $ & % * + - / */
export const docField = (s: string) => s.toUpperCase().replace(/[^A-Z0-9$&%*+\-/]/g, "").slice(0, 36);
/** Buchungstext: max. 60 Zeichen, keine Zeilenumbrüche/Semikolons-Probleme (wird gequotet) */
export const bookingText = (s: string) => s.replace(/[\r\n\t]+/g, " ").trim().slice(0, 60);

export function buildDatevCsv(h: DatevHeader, bookings: Booking[]): string {
  const head = [
    q("EXTF"), 700, 21, q("Buchungsstapel"), 13, stamp(h.createdAt ?? new Date()), "", q("RE"), q(""), q(""),
    h.consultantNo, h.clientNo, ymd(h.fiscalYearStart), h.accountLength ?? 4, ymd(h.from), ymd(h.to), q(bookingText(h.label)),
    q(""), 1, 0, 0, q("EUR"), "", q(""), "", "", q(h.skr), "", "", q(""), q(""),
  ];
  const lines = [head.join(";"), DATEV_COLUMNS.join(";")];
  for (const b of bookings) {
    if (b.amountCents <= 0) continue;
    lines.push([
      datevAmount(b.amountCents), q(b.side), q("EUR"), "", "", q(""),
      b.account, b.contraAccount, q(b.buKey ?? ""), b.date.slice(8, 10) + b.date.slice(5, 7),
      q(docField(b.docNo)), q(""), "", q(bookingText(b.text)),
    ].join(";"));
  }
  return lines.join("\r\n") + "\r\n";
}

// Windows-1252: 0x80–0x9F belegte Zeichen
const CP1252_EXTRA: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89,
  0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
/** Text → Windows-1252; nicht darstellbare Zeichen (z. B. Kyrillisch) → "?" */
export function encodeCp1252(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    out[n++] = c < 0x80 || (c >= 0xa0 && c <= 0xff) ? c : CP1252_EXTRA[c] ?? 0x3f;
  }
  return out.slice(0, n);
}
