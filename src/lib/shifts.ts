/** Schichten: Nettozeit (ohne Pausen), Bezahlung, automatisches Ende */
import type { Shift } from "@/lib/supabase/types";

const MIN = 60_000;

/** Netto-Minuten einer Schicht (laufende Pause/Schicht bis jetzt) */
export function shiftNetMinutes(s: Pick<Shift, "started_at" | "ended_at" | "break_minutes" | "break_started_at">, now = Date.now()): number {
  const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
  const gross = (end - new Date(s.started_at).getTime()) / MIN;
  const runningBreak = s.break_started_at && !s.ended_at ? (now - new Date(s.break_started_at).getTime()) / MIN : 0;
  return Math.max(0, gross - s.break_minutes - runningBreak);
}

export function shiftPayCents(s: Pick<Shift, "started_at" | "ended_at" | "break_minutes" | "break_started_at" | "rate_cents">, now = Date.now()): number {
  return Math.round((shiftNetMinutes(s, now) / 60) * s.rate_cents);
}

/** Vergessene Schicht: nach N Stunden automatisch beenden → Ende = Start + N h, "prüfen" */
export function autoCloseShift(s: Pick<Shift, "started_at" | "ended_at" | "break_minutes" | "break_started_at">, hours: number, now = Date.now()):
  | null
  | { ended_at: string; break_minutes: number } {
  if (s.ended_at) return null;
  const limit = new Date(s.started_at).getTime() + hours * 3600_000;
  if (now < limit) return null;
  let breaks = s.break_minutes;
  if (s.break_started_at) breaks += Math.max(0, (limit - new Date(s.break_started_at).getTime()) / MIN);
  return { ended_at: new Date(limit).toISOString(), break_minutes: Math.round(breaks) };
}

/**
 * Automatische Zuweisung: wer hat an dem Tag die wenigsten offenen Aufgaben?
 * Urlaub/Krank/Archiviert übersprungen, optional nur innerhalb einer Gruppe.
 */
export function pickAssignee(
  members: { id: string; status: string; role: string; group_id: string | null; archived_at: string | null; full_name: string }[],
  openTasksByMember: Map<string, number>,
  opts: { groupId?: string | null } = {},
): string | null {
  const candidates = members.filter(
    (m) => m.role === "employee" && m.status === "active" && !m.archived_at && (!opts.groupId || m.group_id === opts.groupId),
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) => (openTasksByMember.get(a.id) ?? 0) - (openTasksByMember.get(b.id) ?? 0) || a.full_name.localeCompare(b.full_name));
  return candidates[0]!.id;
}
