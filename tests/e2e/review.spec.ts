import { expect, test } from "@playwright/test";
import { loginAs, resetDemo } from "./helpers";

const T1 = "/boss/tasks/00000000-0000-4000-8000-000000000401";

test("Fertig → zur Prüfung → Nacharbeit → Abnahme", async ({ browser }) => {
  const staff = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  await resetDemo(staff);
  await staff.getByRole("button", { name: /Dmitri Iwanow/ }).click();
  await staff.waitForURL(/staff\/today/);

  // Mitarbeiter: Aufgabe "Treppenhaus reinigen – Haus A" läuft → Fertig
  const card = staff.locator("div.card-white", { hasText: "Treppenhaus reinigen – Haus A" }).first();
  await card.getByRole("button", { name: /Fertig/ }).click();
  await expect(card.getByText("Wartet auf Prüfung durch den Chef")).toBeVisible();
  await expect.poll(async () => (await staff.request.post("/api/sync", { data: { ops: [] } })).status()).toBe(200);
  await staff.waitForTimeout(1500);

  // Chef: zurückgeben (Kommentar Pflicht)
  const boss = await loginAs(browser, /Anna Becker/);
  await boss.goto(T1);
  await expect(boss.getByText("Wartet auf Ihre Prüfung")).toBeVisible();
  await boss.getByRole("button", { name: "Zur Nacharbeit zurück" }).click();
  await boss.getByPlaceholder("Was muss nachgebessert werden?").fill("Geländer im 3. OG fehlt noch");
  await boss.getByRole("button", { name: "Zurückgeben" }).click();
  await expect(boss.getByText("Zurück zur Nacharbeit").first()).toBeVisible();

  // Mitarbeiter sieht Nacharbeit + Kommentar, gibt erneut ab
  await staff.goto("/staff/tasks/00000000-0000-4000-8000-000000000401");
  await expect(staff.getByText("Geländer im 3. OG fehlt noch").first()).toBeVisible();
  await staff.getByRole("button", { name: /Fertig/ }).click();
  await expect(staff.getByText("Wartet auf Prüfung durch den Chef")).toBeVisible();
  await staff.waitForTimeout(1500);

  // Chef nimmt ab mit 5 Sternen
  await boss.goto(T1);
  await boss.getByRole("radio", { name: "5/5" }).click();
  await boss.getByRole("button", { name: "Arbeit abnehmen" }).click();
  await expect(boss.getByText(/Abgenommen/)).toBeVisible();
  await expect(boss.getByText("5/5")).toBeVisible();
});

test("Mitarbeiter kann nicht selbst abnehmen (API)", async ({ browser }) => {
  const staff = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  const res = await staff.request.post("/api/sync", {
    data: { ops: [{ id: "x1", op: "status", taskId: "00000000-0000-4000-8000-000000000402", status: "done", at: new Date().toISOString() }] },
  });
  const body = await res.json();
  expect(body.results[0].ok).toBe(false);
});
