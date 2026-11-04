import { describe, expect, it } from "vitest";
import { autoAcceptDue, reviewReminderDue, staffCanTransition } from "@/lib/workflow";

describe("staffCanTransition", () => {
  it("Mitarbeiter darf nie selbst auf done setzen", () => {
    for (const from of ["new", "in_progress", "review", "rework", "done"] as const) {
      if (from !== "done") expect(staffCanTransition(from, "done")).toBe(false);
    }
  });
  it("erlaubte Wege", () => {
    expect(staffCanTransition("new", "in_progress")).toBe(true);
    expect(staffCanTransition("in_progress", "review")).toBe(true);
    expect(staffCanTransition("rework", "in_progress")).toBe(true);
    expect(staffCanTransition("rework", "review")).toBe(true);
  });
  it("aus review/done kommt der Mitarbeiter nicht zurück", () => {
    expect(staffCanTransition("review", "in_progress")).toBe(false);
    expect(staffCanTransition("done", "in_progress")).toBe(false);
    expect(staffCanTransition("review", "rework")).toBe(false);
  });
});

describe("Auto-Abnahme", () => {
  const sub = "2026-01-01T10:00:00Z";
  const t0 = new Date(sub).getTime();
  const h = 3600_000;
  it("nach N Tagen fällig, vorher nicht, ausgeschaltet nie", () => {
    expect(autoAcceptDue(sub, 3, t0 + 71 * h)).toBe(false);
    expect(autoAcceptDue(sub, 3, t0 + 72 * h)).toBe(true);
    expect(autoAcceptDue(sub, null, t0 + 999 * h)).toBe(false);
    expect(autoAcceptDue(null, 3, t0 + 999 * h)).toBe(false);
  });
  it("Erinnerung einen Tag vorher, nur einmal", () => {
    expect(reviewReminderDue(sub, 3, null, t0 + 47 * h)).toBe(false);
    expect(reviewReminderDue(sub, 3, null, t0 + 49 * h)).toBe(true);
    expect(reviewReminderDue(sub, 3, "2026-01-03T12:00:00Z", t0 + 49 * h)).toBe(false);
    expect(reviewReminderDue(sub, 3, null, t0 + 73 * h)).toBe(false); // dann schon Auto-Abnahme
  });
});

import { scrub } from "@/lib/report-error";
import { buildCsp } from "@/lib/csp";

describe("Sicherheit", () => {
  it("Fehlerberichte ohne personenbezogene Daten", () => {
    const s = scrub("Fehler für max.muster@firma.de member 00000000-0000-4000-8000-000000000401 von 10.1.2.3");
    expect(s).not.toMatch(/@firma/);
    expect(s).not.toMatch(/0000-4000/);
    expect(s).not.toMatch(/10\.1\.2\.3/);
  });
  it("CSP: Nonce, keine fremden Frames, Supabase erlaubt", () => {
    const c = buildCsp("abc", { supabaseUrl: "https://xyz.supabase.co" });
    expect(c).toContain("'nonce-abc'");
    expect(c).toContain("frame-ancestors 'none'");
    expect(c).toContain("https://xyz.supabase.co");
    expect(c).toContain("wss://xyz.supabase.co");
    expect(c).not.toContain("unsafe-eval");
  });
});

import { parseMentions } from "@/lib/mentions";
describe("@Erwähnungen", () => {
  const people = [{ id: "a", full_name: "Anna Becker" }, { id: "d", full_name: "Dmitri Iwanow" }, { id: "x", full_name: "Annabell Fuchs" }];
  it("findet Vorname und vollen Namen, keine Teiltreffer", () => {
    expect(parseMentions("Bitte @Dmitri prüfen", people)).toEqual(["d"]);
    expect(parseMentions("@anna becker danke", people)).toEqual(["a"]);
    expect(parseMentions("@Annabell bitte", people)).toEqual(["x"]);
    expect(parseMentions("keine Erwähnung", people)).toEqual([]);
  });
});
