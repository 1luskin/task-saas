import { expect, test } from "@playwright/test";
import { loginAs, resetDemo } from "./helpers";

test("Einstellungen: Felder ausblenden, Funktionen schalten, Sicherheit", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await resetDemo(boss);
  await boss.getByRole("button", { name: /Anna Becker/ }).click();
  await boss.waitForURL(/boss/);
  await boss.goto("/boss/settings");
  await expect(boss.getByText("Logo der Firma")).toBeVisible();
  await expect(boss.getByText("Letzte Anmeldungen")).toBeVisible();
  await expect(boss.getByRole("button", { name: "Auf allen Geräten abmelden" })).toBeVisible();

  // Beschreibung ausblenden → nicht mehr im Formular
  await boss.getByRole("switch", { name: "Beschreibung" }).click();
  await boss.waitForTimeout(800);
  await boss.goto("/boss/tasks/new");
  await expect(boss.getByLabel("Titel")).toBeVisible();
  await expect(boss.getByLabel("Beschreibung")).toHaveCount(0);

  // Berichte für die Firma ausschalten → Menüpunkt weg, PDF 403
  await boss.goto("/boss/settings");
  await boss.getByRole("switch", { name: "Berichte (PDF)" }).click();
  await boss.waitForTimeout(800);
  await boss.goto("/boss");
  await expect(boss.getByRole("link", { name: "Berichte" })).toHaveCount(0);
  expect((await boss.request.get("/api/reports/weekly-pdf")).status()).toBe(403);
  await resetDemo(boss);
});
