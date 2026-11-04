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
