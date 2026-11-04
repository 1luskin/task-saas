/** Testzeitraum & Tarif – gleiche Logik wie private.firm_can_write in der DB */
import type { Firm } from "@/lib/supabase/types";

export const TRIAL_DAYS = 14;
const DAY = 864e5;

export function canWrite(f: Pick<Firm, "plan" | "trial_ends_at" | "is_demo">, now = Date.now()): boolean {
  if (f.is_demo) return true;
  if (f.plan === "paid") return true;
  if (f.plan === "trial") return new Date(f.trial_ends_at).getTime() > now;
  return false; // expired / blocked
}

export interface TrialInfo {
  plan: Firm["plan"];
  daysLeft: number; // aufgerundet, ≥ 0
  totalDays: number;
  progress: number; // 0..1 verbrauchter Anteil
  expired: boolean;
  blocked: boolean;
  canWrite: boolean;
  endingSoon: boolean; // ≤ 3 Tage
}

export function trialInfo(f: Pick<Firm, "plan" | "trial_ends_at" | "is_demo">, now = Date.now()): TrialInfo {
  const msLeft = new Date(f.trial_ends_at).getTime() - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / DAY));
  const expired = !f.is_demo && (f.plan === "expired" || (f.plan === "trial" && msLeft <= 0));
  return {
    plan: f.plan,
    daysLeft,
    totalDays: TRIAL_DAYS,
    progress: Math.min(1, Math.max(0, 1 - daysLeft / TRIAL_DAYS)),
    expired,
    blocked: f.plan === "blocked",
    canWrite: canWrite(f, now),
    endingSoon: f.plan === "trial" && !expired && daysLeft <= 3,
  };
}
