import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("Testzeitraum-Karte, Tarife und Zahlungs-Platzhalter", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await expect(boss.getByText(/Noch \d+ von 14 Tagen/).first()).toBeVisible();
  await boss.goto("/boss/plans");
  await expect(boss.getByRole("heading", { name: "Tarife" })).toBeVisible();
  await boss.getByRole("button", { name: "Bezahlen" }).first().click();
  await expect(boss.getByRole("heading", { name: "Online-Zahlung kommt bald" })).toBeVisible();
});

test("Ansehen als Mitarbeiter und zurück", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await boss.getByRole("button", { name: "Mitarbeiter", exact: true }).click();
  await boss.waitForURL(/staff\/today/);
  await expect(boss.getByText(/Sie sehen die App als/)).toBeVisible();
  await boss.getByRole("button", { name: "Inhaber" }).click();
  await boss.waitForURL(/\/boss$/);
});

test("Onboarding-Seite mit 3 Schritten", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await boss.goto("/boss/welcome");
  await expect(boss.getByText("Firma angelegt")).toBeVisible();
  await expect(boss.getByText("Ersten Mitarbeiter einladen")).toBeVisible();
  await expect(boss.getByText("Erste Aufgabe anlegen")).toBeVisible();
});
