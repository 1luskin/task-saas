import { describe, expect, it } from "vitest";
import { autoCloseShift, pickAssignee, shiftNetMinutes, shiftPayCents } from "@/lib/shifts";

const t0 = new Date("2026-11-04T06:00:00Z").getTime();
const iso = (min: number) => new Date(t0 + min * 60_000).toISOString();

describe("Schichten", () => {
  it("Nettozeit ohne Pausen, Bezahlung nach Satz", () => {
    const s = { started_at: iso(0), ended_at: iso(9 * 60), break_minutes: 30, break_started_at: null, rate_cents: 2000 };
    expect(shiftNetMinutes(s)).toBe(510);
    expect(shiftPayCents(s)).toBe(17000);
  });
  it("laufende Pause zählt nicht", () => {
    const s = { started_at: iso(0), ended_at: null, break_minutes: 0, break_started_at: iso(120) };
    expect(shiftNetMinutes(s, t0 + 150 * 60_000)).toBe(120);
  });
  it("vergessene Schicht nach 12 h automatisch beenden", () => {
    const s = { started_at: iso(0), ended_at: null, break_minutes: 15, break_started_at: null };
    expect(autoCloseShift(s, 12, t0 + 11 * 3600_000)).toBeNull();
    const c = autoCloseShift(s, 12, t0 + 20 * 3600_000)!;
    expect(c.ended_at).toBe(iso(12 * 60));
    expect(c.break_minutes).toBe(15);
  });
});

describe("Automatische Zuweisung", () => {
  const m = (id: string, extra: Partial<{ status: string; group_id: string | null; role: string }> = {}) =>
    ({ id, full_name: id, status: "active", role: "employee", group_id: null, archived_at: null, ...extra });
  it("wenigste offene Aufgaben, Urlaub/Krank übersprungen, Gruppe beachtet", () => {
    const members = [m("a"), m("b", { status: "vacation" }), m("c", { group_id: "g1" }), m("boss", { role: "boss" })];
    const open = new Map([["a", 3], ["c", 1]]);
    expect(pickAssignee(members, open)).toBe("c");
    expect(pickAssignee(members, open, { groupId: "g1" })).toBe("c");
    expect(pickAssignee(members, new Map([["a", 0], ["c", 5]]))).toBe("a");
    expect(pickAssignee([m("x", { status: "sick" })], new Map())).toBeNull();
  });
});

import { berlinLocalToISO, isoToBerlinLocal } from "@/lib/dates";
describe("Berliner Ortszeit ↔ UTC", () => {
  it("Winterzeit (UTC+1) und Sommerzeit (UTC+2)", () => {
    expect(berlinLocalToISO("2026-11-04T08:30")).toBe("2026-11-04T07:30:00.000Z");
    expect(berlinLocalToISO("2026-07-01T08:30")).toBe("2026-07-01T06:30:00.000Z");
    expect(isoToBerlinLocal("2026-07-01T06:30:00.000Z")).toBe("2026-07-01T08:30");
  });
});
