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
 * Auszahlung für eine Aufgabe: Festpreis (nur wenn erledigt) + Stunden × Satz.
 * Ob Festpreis/Stundenlohn gilt, steckt bereits in den Daten:
 * fixed_pay_cents wird nur bei passendem Modus gesetzt, rate_cents per Trigger.
 */
export function taskPay(task: Pick<Task, "status" | "fixed_pay_cents">, entries: Pick<TimeEntry, "started_at" | "ended_at" | "rate_cents">[]): TaskPay {
  const minutes = entries.reduce((s, e) => s + minutesBetween(e.started_at, e.ended_at), 0);
  const hourlyCents = entries.reduce((s, e) => s + entryPayCents(e), 0);
  const fixedCents = task.status === "done" ? (task.fixed_pay_cents ?? 0) : 0;
  return { minutes, hourlyCents, fixedCents, totalCents: hourlyCents + fixedCents };
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
