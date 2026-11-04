import type { Member, Task, TimeEntry } from "@/lib/supabase/types";
import { minutesBetween } from "./dates";

/** Stundenanteil eines Zeiteintrags in Cent (laufende Einträge bis jetzt). */
export function entryPayCents(e: Pick<TimeEntry, "started_at" | "ended_at" | "rate_cents">, now = Date.now()): number {
  return Math.round((minutesBetween(e.started_at, e.ended_at, now) / 60) * e.rate_cents);
}

export interface TaskPay {
  minutes: number;
  hourlyCents: number;
  fixedCents: number;
  totalCents: number;
}

/**
 * Auszahlung für eine Aufgabe: Festpreis + Stunden × Satz.
 * Gutgeschrieben wird BEIDES erst nach Abnahme (status done + accepted_at).
 * Vorher steht der Betrag als "wartet auf Abnahme" (projectedCents) bereit.
 * Ob Festpreis/Stundenlohn gilt, steckt bereits in den Daten:
 * fixed_pay_cents wird nur bei passendem Modus gesetzt, rate_cents per Trigger.
 */
export function taskPay(
  task: Pick<Task, "status" | "fixed_pay_cents"> & { accepted_at?: string | null },
  entries: Pick<TimeEntry, "started_at" | "ended_at" | "rate_cents">[],
  now = Date.now(),
): TaskPay & { accepted: boolean; projectedCents: number } {
  const minutes = entries.reduce((s, e) => s + minutesBetween(e.started_at, e.ended_at, now), 0);
  const hourly = entries.reduce((s, e) => s + entryPayCents(e, now), 0);
  const fixed = task.fixed_pay_cents ?? 0;
  const accepted = task.status === "done" && Boolean(task.accepted_at);
  const projectedCents = hourly + fixed;
  return {
    minutes,
    hourlyCents: accepted ? hourly : 0,
    fixedCents: accepted ? fixed : 0,
    totalCents: accepted ? projectedCents : 0,
    accepted,
    projectedCents,
  };
}

/** Gilt der Festpreis für diesen Mitarbeiter? */
export function fixedApplies(m: Pick<Member, "pay_mode"> | null | undefined): boolean {
  return !m || m.pay_mode === "fixed" || m.pay_mode === "both";
}

export function groupBy<T, K extends string>(items: T[], key: (t: T) => K | null | undefined): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    if (k == null) continue;
    const arr = map.get(k);
    if (arr) arr.push(it);
    else map.set(k, [it]);
  }
  return map;
}
