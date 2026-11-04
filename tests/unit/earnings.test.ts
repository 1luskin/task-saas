import { describe, expect, it } from "vitest";
import { entryPayCents, taskPay } from "@/lib/earnings";
import { parseMoneyToCents, formatMoney } from "@/lib/money";

describe("money", () => {
  it("parst deutsche Beträge in Cent", () => {
    expect(parseMoneyToCents("1.234,56")).toBe(123456);
    expect(parseMoneyToCents("12,5")).toBe(1250);
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("-3")).toBeNaN();
  });
  it("formatiert de-DE", () => {
    expect(formatMoney(123456).replace(/ /g, " ")).toBe("1.234,56 €");
  });
});

describe("earnings", () => {
  it("Stundenlohn: 90 min × 20 €/h = 30 €", () => {
    expect(entryPayCents({ started_at: "2026-01-01T08:00:00Z", ended_at: "2026-01-01T09:30:00Z", rate_cents: 2000 })).toBe(3000);
  });
  it("Festpreis nur bei erledigter Aufgabe", () => {
    const e = [{ started_at: "2026-01-01T08:00:00Z", ended_at: "2026-01-01T09:00:00Z", rate_cents: 1000 }];
    expect(taskPay({ status: "in_progress", fixed_pay_cents: 5000 }, e).totalCents).toBe(1000);
    expect(taskPay({ status: "done", fixed_pay_cents: 5000 }, e).totalCents).toBe(6000);
  });
});
