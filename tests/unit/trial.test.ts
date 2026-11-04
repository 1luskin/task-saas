import { describe, expect, it } from "vitest";
import { canWrite, trialInfo } from "@/lib/trial";

const now = new Date("2026-11-10T12:00:00Z").getTime();
const days = (n: number) => new Date(now + n * 864e5).toISOString();

describe("Testzeitraum", () => {
  it("läuft: schreiben erlaubt, Tage aufgerundet", () => {
    const i = trialInfo({ plan: "trial", trial_ends_at: days(8.2), is_demo: false }, now);
    expect(i.canWrite).toBe(true);
    expect(i.daysLeft).toBe(9);
    expect(i.expired).toBe(false);
    expect(i.endingSoon).toBe(false);
  });
  it("endet bald (≤ 3 Tage)", () => {
    expect(trialInfo({ plan: "trial", trial_ends_at: days(2), is_demo: false }, now).endingSoon).toBe(true);
  });
  it("abgelaufen: nichts Neues anlegen", () => {
    const i = trialInfo({ plan: "trial", trial_ends_at: days(-1), is_demo: false }, now);
    expect(i.expired).toBe(true);
    expect(i.canWrite).toBe(false);
    expect(i.progress).toBe(1);
  });
  it("bezahlt / Demo immer schreibbar, gesperrt nie", () => {
    expect(canWrite({ plan: "paid", trial_ends_at: days(-100), is_demo: false }, now)).toBe(true);
    expect(canWrite({ plan: "trial", trial_ends_at: days(-100), is_demo: true }, now)).toBe(true);
    expect(canWrite({ plan: "blocked", trial_ends_at: days(100), is_demo: false }, now)).toBe(false);
    expect(canWrite({ plan: "expired", trial_ends_at: days(100), is_demo: false }, now)).toBe(false);
  });
});
