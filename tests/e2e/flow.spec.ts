import { expect, test } from "@playwright/test";
import { loginAs, resetDemo } from "./helpers";

test("Ganzer Ablauf: Chef legt Aufgabe an → Mitarbeiter beginnt/fertig → Abnahme → Verdienst", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await resetDemo(boss);
  await boss.getByRole("button", { name: /Anna Becker/ }).click();
  await boss.waitForURL(/boss/);

  await boss.goto("/boss/tasks/new");
  await boss.getByLabel("Titel").fill("E2E Kellerreinigung");
  await boss.getByLabel("Ausführender").selectOption({ label: "Lukas Weber" });
  await boss.getByLabel("Fällig am").fill(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }));
  await boss.getByLabel("Festpreis für Mitarbeiter (€)").fill("80,00");
  await boss.getByRole("button", { name: "Anlegen" }).click();
  await boss.waitForURL(/\/boss\/tasks\/[0-9a-f-]{36}$/);
  const url = boss.url();

  const lukas = await loginAs(browser, /Lukas Weber/, { mobile: true });
  await lukas.goto("/staff/today");
  const card = lukas.locator("div.card-white", { hasText: "E2E Kellerreinigung" }).first();
  await card.getByRole("button", { name: /Begonnen/ }).click();
  await card.getByRole("button", { name: /Fertig/ }).click();
  await expect(card.getByText("Wartet auf Prüfung durch den Chef")).toBeVisible();
  await lukas.waitForTimeout(1500); // Sync-Queue

  // vor der Abnahme: noch nichts verdient
  await lukas.goto(url.replace("/boss/", "/staff/"));
  await expect(lukas.getByText("80,00 €")).toBeVisible();
  await expect(lukas.getByText(/Verdient/)).toHaveCount(0);

  await boss.goto(url);
  await boss.getByRole("button", { name: "Arbeit abnehmen" }).click();
  await expect(boss.getByText(/Abgenommen/)).toBeVisible();

  await lukas.reload();
  await expect(lukas.getByText(/Verdient/).first()).toBeVisible();
  await resetDemo(boss);
});
