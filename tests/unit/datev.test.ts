import { describe, expect, it } from "vitest";
import { buildDatevCsv, datevAmount, docField, encodeCp1252 } from "@/lib/datev";

describe("DATEV EXTF", () => {
  const csv = buildDatevCsv(
    { consultantNo: 1001, clientNo: 1, skr: "03", fiscalYearStart: "2026-01-01", from: "2026-10-01", to: "2026-10-31", label: "Buchungen 10/2026", createdAt: new Date("2026-11-05T10:11:12.345Z") },
    [
      { amountCents: 119000, side: "S", account: 10000, contraAccount: 8400, date: "2026-10-07", docNo: "t-1a2b3c4d", text: "Treppenhaus; \"Haus A\"" },
      { amountCents: 2380, side: "S", account: 4980, contraAccount: 1000, buKey: "9", date: "2026-10-15", docNo: "E 12", text: "Fugenmörtel" },
      { amountCents: 0, side: "S", account: 1, contraAccount: 2, date: "2026-10-15", docNo: "x", text: "leer" },
    ],
  );
  const lines = csv.split("\r\n");
  it("Kopfzeile mit 31 Feldern, Version 700/21/13, Berater/Mandant, Zeitraum, SKR", () => {
    const h = lines[0]!.split(";");
    expect(h).toHaveLength(31);
    expect(h.slice(0, 6)).toEqual(['"EXTF"', "700", "21", '"Buchungsstapel"', "13", "20261105101112345"]);
    expect(h.slice(10, 16)).toEqual(["1001", "1", "20260101", "4", "20261001", "20261031"]);
    expect(h[26]).toBe('"03"');
  });
  it("Buchungszeilen: Betrag mit Komma, Belegdatum TTMM, Felder gequotet, 0-Beträge entfallen", () => {
    expect(lines[1]!.startsWith("Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen")).toBe(true);
    expect(lines[2]).toBe('1190,00;"S";"EUR";;;"";10000;8400;"";0710;"T-1A2B3C4D";"";;"Treppenhaus; ""Haus A"""');
    expect(lines[3]).toBe('23,80;"S";"EUR";;;"";4980;1000;"9";1510;"E12";"";;"Fugenmörtel"');
    expect(lines).toHaveLength(5); // 2 Kopf + 2 Buchungen + leeres Ende
  });
  it("Hilfsfunktionen", () => {
    expect(datevAmount(5)).toBe("0,05");
    expect(docField("re-2026/001 ä")).toBe("RE-2026/001");
    expect(Array.from(encodeCp1252("Mörtel €"))).toEqual([0x4d, 0xf6, 0x72, 0x74, 0x65, 0x6c, 0x20, 0x80]);
    expect(Array.from(encodeCp1252("Дом"))).toEqual([0x3f, 0x3f, 0x3f]);
  });
});
