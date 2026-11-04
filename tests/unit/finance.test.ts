import { beforeEach, describe, expect, it } from "vitest";
import { createFakeClient, demoDb, resetDemoDb } from "@/lib/demo/fake-client";
import { DEMO } from "@/lib/demo/seed";
import { loadFinance } from "@/lib/finance";
import { monthPeriod, todayISO } from "@/lib/dates";
import type { Ctx } from "@/lib/auth";

function ctxFor(userId: string): Ctx {
  const db = demoDb();
  const member = db.members.find((m) => m.user_id === userId)!;
  return { supabase: createFakeClient(userId) as never, member, firm: db.firms[0]!, userId, email: null, acting: false, ownMemberId: member.id, demoMemberId: null, settings: { onboarding_done: true, hints_dismissed: [] } };
}

beforeEach(() => resetDemoDb());

describe("Finanzen: Gewinn mit Material, Prämien, Erstattungen", () => {
  it("Gewinn = Umsatz − Lohn − Material; Erstattung erhöht nur den Verdienst", async () => {
    const f = await loadFinance(ctxFor(DEMO.bossUser), monthPeriod(todayISO()));
    expect(f.materialsCents).toBe(6450); // nur genehmigte Ausgaben abgenommener Aufgaben
    expect(f.profitCents).toBe(f.revenueCents - f.payoutCents - f.materialsCents);
    const dmitri = f.perMember.get(DEMO.employees[0]!.member)!;
    expect(dmitri.adjustCents).toBe(2500); // Sonntagszuschlag
  });

  it("genehmigte Erstattung landet beim Mitarbeiter, nicht im Lohn", async () => {
    const db = demoDb();
    const exp = db.expenses.find((e) => e.reimburse)!;
    // Aufgabe abnehmen + Ausgabe genehmigen
    const t = db.tasks.find((x) => x.id === exp.task_id)!;
    Object.assign(t, { status: "done", accepted_at: new Date().toISOString() });
    exp.status = "approved";
    const f = await loadFinance(ctxFor(DEMO.bossUser), monthPeriod(todayISO()));
    const lukas = f.perMember.get(DEMO.employees[1]!.member)!;
    expect(lukas.reimburseCents).toBe(2380);
    expect(lukas.totalCents).toBe(lukas.fixedCents + lukas.hourlyCents + lukas.shiftCents + lukas.adjustCents + 2380);
  });

  it("Mitarbeiter sieht nur eigene Zahlen, keine Kundenpreise", async () => {
    const f = await loadFinance(ctxFor(DEMO.employees[0]!.user), monthPeriod(todayISO()), { memberId: DEMO.employees[0]!.member });
    expect(f.revenueCents).toBe(0);
    expect([...f.perMember.keys()]).toEqual([DEMO.employees[0]!.member]);
  });
});
