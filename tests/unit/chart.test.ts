import { describe, expect, it } from "vitest";
import { niceTicks } from "@/lib/chart";
import { isoWeekNumber } from "@/lib/dates";

describe("Diagramm-Achsen", () => {
  it("runde Ticks inkl. 0 und negativer Werte", () => {
    expect(niceTicks(0, 7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(-120, 380)).toEqual([-200, 0, 200, 400]);
    expect(niceTicks(0, 0)).toEqual([0, 1]);
    expect(niceTicks(0, 2, 4, true)).toEqual([0, 1, 2]);
  });
  it("ISO-Kalenderwoche", () => {
    expect(isoWeekNumber("2026-11-05")).toBe(45);
    expect(isoWeekNumber("2027-01-01")).toBe(53);
    expect(isoWeekNumber("2026-01-01")).toBe(1);
  });
});
