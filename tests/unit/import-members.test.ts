import { describe, expect, it } from "vitest";
import { validateImportRows } from "@/lib/import-members";

describe("Import Mitarbeiter", () => {
  it("prüft Pflichtfelder, E-Mail, Duplikate, Lohn und Urlaub", () => {
    const rows = [
      ["Anna Schmidt", "Anna@Example.de", "0171", "Bau", "18,50", "28"],
      ["", "x@example.de"],
      ["Bob", "kein-mail"],
      ["Carl", "anna@example.de"],
      ["Dora", "dora@example.de", "", "", "abc"],
      ["Emil", "", "", "", "", "70"],
      [null, null, null],
      ["Fritz", "boss@firma.de"],
      ["Gerd", { text: "gerd@example.de" }, "", "", 20, 24],
    ];
    const r = validateImportRows(rows, new Set(["boss@firma.de"]));
    expect(r.valid.map((v) => v.full_name)).toEqual(["Anna Schmidt", "Gerd"]);
    expect(r.valid[0]).toMatchObject({ email: "anna@example.de", hourly_rate_cents: 1850, vacation_days: 28, group: "Bau", row: 2 });
    expect(r.valid[1]).toMatchObject({ email: "gerd@example.de", hourly_rate_cents: 2000 });
    expect(r.errors).toEqual([
      { row: 3, code: "name" }, { row: 4, code: "email" }, { row: 5, code: "dupe" }, { row: 6, code: "rate" }, { row: 7, code: "days" }, { row: 9, code: "dupe" },
    ]);
  });
});
