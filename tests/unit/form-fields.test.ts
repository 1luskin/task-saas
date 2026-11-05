import { describe, expect, it } from "vitest";
import { fieldsToText, parseFormFields } from "@/lib/form-fields";

describe("Formular-Felder", () => {
  it("parst Typen, Optionen und meldet fehlerhafte Zeilen", () => {
    const r = parseFormFields("text;Name\nselect;Zustand;Gut | Mängel\n\nfoo;Bar\nselect;Ohne Optionen\ncheckbox;Sauber");
    expect(r.fields.map((f) => f.type)).toEqual(["text", "select", "checkbox"]);
    expect(r.fields[1]?.options).toEqual(["Gut", "Mängel"]);
    expect(r.fields.map((f) => f.id)).toEqual(["f1", "f2", "f3"]);
    expect(r.errors).toEqual([4, 5]);
  });
  it("Round-Trip Text ↔ Felder", () => {
    const src = "text;Name\nselect;Zustand;Gut|Mängel";
    expect(fieldsToText(parseFormFields(src).fields)).toBe(src);
  });
});
