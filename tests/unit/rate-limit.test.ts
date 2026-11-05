import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
import { hit, LIMITS } from "@/lib/rate-limit";

describe("Rate limit (Demo/Speicher)", () => {
  it("OTP: 5 pro Stunde je E-Mail, danach gesperrt; andere Schlüssel unabhängig", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    const key = `t-${Math.random()}`;
    const results = [];
    for (let i = 0; i < LIMITS.otpEmail.max + 2; i++) results.push(await hit("otpEmail", key));
    expect(results).toEqual([true, true, true, true, true, false, false]);
    expect(await hit("otpEmail", `${key}-other`)).toBe(true);
    vi.unstubAllEnvs();
  });
  it("Fenster beginnt neu", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
    const key = `w-${Math.random()}`;
    for (let i = 0; i < LIMITS.otpVerify.max; i++) expect(await hit("otpVerify", key)).toBe(true);
    expect(await hit("otpVerify", key)).toBe(false);
    vi.setSystemTime(new Date("2026-11-05T10:16:00Z")); // 15-min-Fenster vorbei
    expect(await hit("otpVerify", key)).toBe(true);
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
});
