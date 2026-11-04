import { expect, test } from "@playwright/test";
import { loginAs, resetDemo } from "./helpers";

test("Schicht, Ausgabe, Freigabe, Prämie, Zeitkorrektur mit Begründung", async ({ browser }) => {
  const staff = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  await resetDemo(staff);
  await staff.getByRole("button", { name: /Dmitri Iwanow/ }).click();
  await staff.waitForURL(/staff\/today/);
  staff.on("dialog", (d) => d.accept());

  // laufende Schicht (Demo) → Pause → Weiter → beenden → neue starten
  await expect(staff.getByText(/Im Einsatz seit/)).toBeVisible();
  await staff.getByRole("button", { name: "Pause" }).click();
  await expect(staff.getByText(/Pause seit/)).toBeVisible();
  await staff.getByRole("button", { name: "Weiter" }).click();
  await staff.getByRole("button", { name: "Schicht beenden" }).click();
  await expect(staff.getByRole("button", { name: "Schicht beginnen" })).toBeVisible();
  await staff.waitForTimeout(1500);

  // Ausgabe zur eigenen Aufgabe
  await staff.goto("/staff/tasks/00000000-0000-4000-8000-000000000401");
  await staff.getByRole("button", { name: "Ausgabe hinzufügen" }).click();
  await staff.getByLabel("Betrag (€)").fill("12,50");
  await staff.getByLabel("Was gekauft?").fill("Putzmittel");
  await staff.getByRole("button", { name: "Speichern" }).click();
  await expect(staff.getByText("Putzmittel")).toBeVisible();
  await expect(staff.getByText("Wartet auf Freigabe").first()).toBeVisible();

  // Chef: Ausgabe freigeben, Prämie buchen
  const boss = await loginAs(browser, /Anna Becker/);
  await boss.goto("/boss/money");
  const row = boss.locator("div", { hasText: "Putzmittel" }).last();
  await row.getByRole("button", { name: "Genehmigen" }).click();
  await expect(boss.getByText("Putzmittel")).toHaveCount(0);
  await boss.getByLabel("Betrag (€)").fill("30");
  await boss.getByLabel("Begründung (Pflicht)").fill("Einspringen am Feiertag");
  await boss.getByRole("button", { name: "Buchen" }).click();
  await expect(boss.getByText("Einspringen am Feiertag")).toBeVisible();

  // Zeitkorrektur einer Schicht mit Begründung → Verlauf, auch für den Mitarbeiter sichtbar
  await boss.goto("/boss/employees/00000000-0000-4000-8000-000000000202/times");
  await boss.getByRole("button", { name: "Korrigieren" }).first().click();
  await boss.getByLabel("Begründung der Änderung (Pflicht)").fill("Ende vergessen");
  await boss.getByRole("button", { name: "Speichern" }).click();
  await expect(boss.getByText("Ende vergessen")).toBeVisible();
  await staff.goto("/staff/times");
  await expect(staff.getByText("Ende vergessen")).toBeVisible();
  await expect(staff.getByRole("button", { name: "Korrigieren" })).toHaveCount(0);
});
