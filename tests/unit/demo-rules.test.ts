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
