import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { autoCloseShift } from "@/lib/shifts";

/** Vergessene Schichten nach N Stunden (Firmeneinstellung) beenden und als "prüfen" markieren */
export async function runShiftJobs(now = Date.now()) {
  const admin = createAdminClient();
  const { data: open } = await admin.from("shifts").select("*").is("ended_at", null);
  if (!open?.length) return { autoClosed: 0 };
  const firmIds = [...new Set(open.map((s) => s.firm_id))];
  const { data: firms } = await admin.from("firms").select("id, shift_autoclose_hours").in("id", firmIds);
  const hours = new Map((firms ?? []).map((f) => [f.id, f.shift_autoclose_hours]));
  let autoClosed = 0;
  for (const s of open) {
    const c = autoCloseShift(s, hours.get(s.firm_id) ?? 12, now);
    if (!c) continue;
    await admin
      .from("shifts")
      .update({ ended_at: c.ended_at, break_minutes: c.break_minutes, break_started_at: null, auto_closed: true, needs_review: true })
      .eq("id", s.id)
      .is("ended_at", null);
    autoClosed++;
  }
  return { autoClosed };
}
