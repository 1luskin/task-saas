/**
 * Arbeitsablauf einer Aufgabe (identisch mit private.guard_task_write in der DB):
 * new → in_progress → review → done, plus rework (Nacharbeit).
 */
import type { TaskStatus } from "@/lib/supabase/types";

export const STAGES: TaskStatus[] = ["new", "in_progress", "review", "rework", "done"];
export const OPEN_STAGES: TaskStatus[] = ["new", "in_progress", "rework"];

/** Übergänge, die ein Mitarbeiter selbst auslösen darf. "done" nie. */
export function staffCanTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  switch (from) {
    case "new":
      return to === "in_progress" || to === "review";
    case "rework":
      return to === "in_progress" || to === "review";
    case "in_progress":
      return to === "review" || to === "new";
    default:
      return false;
  }
}

const DAY = 24 * 3600 * 1000;

/** Auto-Abnahme fällig? (days = null → ausgeschaltet) */
export function autoAcceptDue(submittedAt: string | null, days: number | null, now = Date.now()): boolean {
  if (!submittedAt || !days) return false;
  return now - new Date(submittedAt).getTime() >= days * DAY;
}

/** Erinnerung an den Chef: einen Tag vor der Auto-Abnahme (bei 1 Tag: nach 12 h) */
export function reviewReminderDue(submittedAt: string | null, days: number | null, remindedAt: string | null, now = Date.now()): boolean {
  if (!submittedAt || !days || remindedAt) return false;
  const lead = days > 1 ? (days - 1) * DAY : DAY / 2;
  return now - new Date(submittedAt).getTime() >= lead && !autoAcceptDue(submittedAt, days, now);
}

/** Verdienst zählt erst nach Abnahme */
export function isAccepted(t: { status: TaskStatus; accepted_at: string | null }): boolean {
  return t.status === "done" && Boolean(t.accepted_at);
}
