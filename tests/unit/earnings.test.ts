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
  const e = [{ started_at: "2026-01-01T08:00:00Z", ended_at: "2026-01-01T09:00:00Z", rate_cents: 1000 }];
  it("Stunden UND Festpreis erst nach Abnahme gutgeschrieben", () => {
    const open = taskPay({ status: "review", fixed_pay_cents: 5000, accepted_at: null }, e);
    expect(open.totalCents).toBe(0);
    expect(open.hourlyCents).toBe(0);
    expect(open.projectedCents).toBe(6000);
    const done = taskPay({ status: "done", fixed_pay_cents: 5000, accepted_at: "2026-01-02T10:00:00Z" }, e);
    expect(done.totalCents).toBe(6000);
    expect(done.accepted).toBe(true);
  });
  it("done ohne accepted_at zählt nicht", () => {
    expect(taskPay({ status: "done", fixed_pay_cents: 5000, accepted_at: null }, e).totalCents).toBe(0);
  });
});
