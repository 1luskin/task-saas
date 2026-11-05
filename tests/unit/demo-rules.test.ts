import { beforeEach, describe, expect, it } from "vitest";
import { createFakeClient, demoDb, resetDemoDb } from "@/lib/demo/fake-client";
import { DEMO } from "@/lib/demo/seed";

/** Der Demo-Client muss dieselben Rechte abbilden wie RLS + Trigger in der DB. */
const boss = () => createFakeClient(DEMO.bossUser);
const dmitri = () => createFakeClient(DEMO.employees[0]!.user);
const lukas = () => createFakeClient(DEMO.employees[1]!.user);
const T1 = "00000000-0000-4000-8000-000000000401"; // Dmitri, in_progress
const T4 = "00000000-0000-4000-8000-000000000404"; // Lukas, new
const T5 = "00000000-0000-4000-8000-000000000405"; // Lukas, review

beforeEach(() => resetDemoDb());

describe("Demo: Status & Abnahme", () => {
  it("Mitarbeiter kann nicht selbst abnehmen", async () => {
    const r = await dmitri().from("tasks").update({ status: "done" }).eq("id", T1);
    expect(r.error?.code).toBe("42501");
  });
  it("Mitarbeiter gibt zur Prüfung ab → submitted_at gesetzt", async () => {
    const r = await dmitri().from("tasks").update({ status: "review" }).eq("id", T1).select().single();
    expect(r.error).toBeNull();
    expect((r.data as { submitted_at: string }).submitted_at).toBeTruthy();
  });
  it("Chef nimmt ab → accepted_at/by, zurück → rework_count", async () => {
    const back = await boss().from("tasks").update({ status: "rework" }).eq("id", T5).select().single();
    expect((back.data as { rework_count: number }).rework_count).toBe(1);
    await lukas().from("tasks").update({ status: "review" }).eq("id", T5);
    const ok = await boss().from("tasks").update({ status: "done", rating: 4 }).eq("id", T5).select().single();
    const row = ok.data as { accepted_at: string; accepted_by: string; rating: number };
    expect(row.accepted_at).toBeTruthy();
    expect(row.accepted_by).toBe(DEMO.boss);
    expect(row.rating).toBe(4);
  });
  it("Mitarbeiter sieht fremde Aufgaben und Kundenpreise nicht", async () => {
    const own = await dmitri().from("tasks").select("*").eq("id", T4);
    expect(own.data).toEqual([]);
    const fin = await dmitri().from("task_finance").select("*");
    expect(fin.data).toEqual([]);
  });
  it("Systemstatus nicht löschbar, eigener schon", async () => {
    const sys = demoDb().task_statuses.find((s) => s.is_system)!;
    await boss().from("task_statuses").delete().eq("id", sys.id);
    expect(demoDb().task_statuses.some((s) => s.id === sys.id)).toBe(true);
    const own = demoDb().task_statuses.find((s) => !s.is_system)!;
    await boss().from("task_statuses").delete().eq("id", own.id);
    expect(demoDb().task_statuses.some((s) => s.id === own.id)).toBe(false);
  });
});

describe("Demo: Testzeitraum", () => {
  it("nach Ablauf blockiert der Server das Anlegen (assertWritable)", async () => {
    const { assertWritable, AuthError } = await import("@/lib/auth");
    const firm = { ...demoDb().firms[0]!, trial_ends_at: new Date(Date.now() - 1000).toISOString() };
    expect(() => assertWritable({ firm } as never)).toThrow(AuthError);
    expect(() => assertWritable({ firm: { ...firm, plan: "paid" } } as never)).not.toThrow();
  });
});

describe("Demo: Ausgaben", () => {
  it("Chef darf genehmigen, Mitarbeiter nicht", async () => {
    const id = demoDb().expenses.find((e) => e.status === "pending")!.id;
    const no = await lukas().from("expenses").update({ status: "approved" }).eq("id", id);
    expect(no.error?.code).toBe("42501");
    const ok = await boss().from("expenses").update({ status: "approved" }).eq("id", id);
    expect(ok.error).toBeNull();
  });
});

describe("Demo: Team", () => {
  it("genehmigter Urlaub blockiert Zuweisung; Mitarbeiter genehmigt sich keinen Urlaub", async () => {
    const olga = DEMO.employees[2]!.member;
    const today = new Date().toISOString().slice(0, 10);
    const r = await boss().from("tasks").insert({ firm_id: DEMO.firm, title: "X", assignee_id: olga, due_date: today });
    expect(r.error?.hint).toBe("member_unavailable");
    const id = demoDb().vacation_requests.find((v) => v.status === "pending")!.id;
    const self = await dmitri().from("vacation_requests").update({ status: "approved" }).eq("id", id);
    expect(self.error).not.toBeNull();
  });
  it("Schichttausch: Kollege akzeptiert, nur Chef genehmigt", async () => {
    const sw = demoDb().shift_swaps[0]!;
    const no = await dmitri().rpc("decide_swap", { p_swap: sw.id, p_action: "approve" });
    expect(no.error).not.toBeNull();
    const ok = await boss().rpc("decide_swap", { p_swap: sw.id, p_action: "approve" });
    expect(ok.error).toBeNull();
    expect(demoDb().shift_plans.find((p) => p.id === sw.plan_id)!.member_id).toBe(DEMO.employees[1]!.member);
  });
});
