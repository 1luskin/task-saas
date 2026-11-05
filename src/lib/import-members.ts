import { parseMoneyToCents } from "./money";

/** Spalten der Vorlage (Reihenfolge fest): Name | E-Mail | Telefon | Gruppe | Stundenlohn € | Urlaubstage */
export const IMPORT_COLUMNS = ["name", "email", "phone", "group", "rate", "vacation"] as const;
export const IMPORT_MAX_ROWS = 500;

export type ImportRow = { row: number; full_name: string; email: string | null; phone: string | null; group: string | null; hourly_rate_cents: number; vacation_days: number | null };
export type ImportError = { row: number; code: "name" | "email" | "dupe" | "rate" | "days" | "phone" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** rows = Datenzeilen ohne Kopfzeile; rowOffset = Zeilennummer der ersten Datenzeile in Excel */
export function validateImportRows(rows: unknown[][], existingEmails: Set<string>, rowOffset = 2): { valid: ImportRow[]; errors: ImportError[] } {
  const valid: ImportRow[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const row = i + rowOffset;
    const cell = (k: number) => {
      const v = r[k];
      if (v === null || v === undefined) return "";
      if (typeof v === "object" && v && "text" in v) return String((v as { text: unknown }).text ?? "").trim(); // Hyperlink-Zellen
      return String(v).trim();
    };
    const [name, emailRaw, phone, group, rateRaw, daysRaw] = [0, 1, 2, 3, 4, 5].map(cell) as [string, string, string, string, string, string];
    if (!name && !emailRaw && !phone) return; // Leerzeile
    if (!name || name.length > 120) return errors.push({ row, code: "name" });
    const email = emailRaw.toLowerCase() || null;
    if (email && (email.length > 254 || !EMAIL.test(email))) return errors.push({ row, code: "email" });
    if (email && (seen.has(email) || existingEmails.has(email))) return errors.push({ row, code: "dupe" });
    if (phone.length > 40) return errors.push({ row, code: "phone" });
    const rate = rateRaw ? parseMoneyToCents(rateRaw.replace("€", "").trim()) : 0;
    if (rate === null || !Number.isFinite(rate) || rate < 0 || rate > 100000) return errors.push({ row, code: "rate" });
    let days: number | null = null;
    if (daysRaw) {
      days = Number(daysRaw.replace(",", "."));
      if (!Number.isInteger(days) || days < 0 || days > 60) return errors.push({ row, code: "days" });
    }
    if (email) seen.add(email);
    valid.push({ row, full_name: name, email, phone: phone || null, group: group || null, hourly_rate_cents: rate, vacation_days: days });
  });
  return { valid, errors };
}
