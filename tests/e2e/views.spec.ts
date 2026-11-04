import { expect, test } from "@playwright/test";
import { loginAs, resetDemo } from "./helpers";

test("Suche, Anheften, Massenaktionen, Kanban-Drag, Tagesansicht, Checklisten-Vorlage, Feed", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await resetDemo(boss);
  await boss.getByRole("button", { name: /Anna Becker/ }).click();
  await boss.waitForURL(/boss/);

  // Suche (Strg+K)
  await boss.waitForLoadState("networkidle");
  await boss.keyboard.press("Control+k");
  await expect(boss.getByRole("combobox", { name: /Suche/ })).toBeFocused();
  await boss.keyboard.type("Fliesen", { delay: 30 });
  await expect(boss.getByRole("option", { name: /Badfliesen verfugen/ })).toBeVisible();
  await boss.keyboard.press("Enter");
  await boss.waitForURL(/boss\/tasks\/00000000-0000-4000-8000-000000000405/);

  // Feed + Duplizieren über Massenaktion
  await boss.goto("/boss");
  await expect(boss.getByRole("heading", { name: "Ereignisse" })).toBeVisible();
  await boss.getByRole("checkbox", { name: "Lager-Inventur Regal A–F" }).check();
  await boss.getByRole("button", { name: "Duplizieren" }).click();
  await expect(boss.getByText("Lager-Inventur Regal A–F")).toHaveCount(2);

  // Kanban: "Trockenbauwand" von "Neu" nach "In Arbeit" ziehen
  await boss.goto("/boss/kanban");
  const card = boss.locator("li", { hasText: "Trockenbauwand Küche stellen" });
  const target = boss.locator('section[aria-label="In Arbeit"]');
  const cb = (await card.boundingBox())!;
  const tb = (await target.boundingBox())!;
  await boss.mouse.move(cb.x + 20, cb.y + 20);
  await boss.mouse.down();
  await boss.mouse.move(cb.x + 40, cb.y + 40, { steps: 3 });
  await boss.mouse.move(tb.x + tb.width / 2, tb.y + 80, { steps: 8 });
  await boss.mouse.up();
  await expect(target.getByText("Trockenbauwand Küche stellen")).toBeVisible();
  await boss.reload();
  await expect(boss.locator('section[aria-label="In Arbeit"]').getByText("Trockenbauwand Küche stellen")).toBeVisible();

  // Tagesansicht im Kalender
  await boss.goto("/boss/calendar?view=day");
  await expect(boss.getByRole("button", { name: "Tag" })).toBeVisible();

  // Checklisten-Vorlage einfügen
  await boss.goto("/boss/tasks/00000000-0000-4000-8000-000000000406");
  await boss.getByRole("combobox", { name: "Vorlage einfügen" }).selectOption({ label: "Fenster" });
  await expect(boss.getByText("Fensterbänke")).toBeVisible();
  await resetDemo(boss);
});

test("Mitarbeiter findet über die Suche nur Eigenes", async ({ browser }) => {
  const staff = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  await staff.waitForLoadState("networkidle");
  const box = staff.getByRole("combobox", { name: /Suche/ });
  await box.fill("Fliesen"); // Aufgabe von Lukas
  await staff.waitForTimeout(800);
  await expect(staff.getByRole("option")).toHaveCount(0);
  await box.fill("Treppenhaus");
  await expect(staff.getByRole("option", { name: /Treppenhaus reinigen – Haus A/ })).toBeVisible();
});
