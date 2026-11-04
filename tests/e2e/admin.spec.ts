import { expect, test } from "@playwright/test";
import { loginAs, resetDemo } from "./helpers";

test("Superadmin: Übersicht, +14 Tage mit Protokoll, Flags, Landing-Texte", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await resetDemo(boss);
  await boss.getByRole("button", { name: /Anna Becker/ }).click();
  await boss.waitForURL(/boss/);

  await boss.goto("/admin");
  await expect(boss.getByText("Firmen gesamt")).toBeVisible();
  await expect(boss.getByRole("link", { name: "Glanz & Bau Service GmbH" })).toBeVisible();
  await boss.getByRole("button", { name: "+14 Tage" }).first().click();
  await boss.waitForTimeout(800);
  await boss.goto("/admin/audit");
  await expect(boss.getByText("trial_extend").first()).toBeVisible();

  // Flag global aus → Menüpunkt weg, Seite 404
  await boss.goto("/admin/flags");
  await boss.getByRole("switch", { name: "templates" }).click();
  await boss.waitForTimeout(800);
  await boss.goto("/boss");
  await expect(boss.getByRole("link", { name: "Vorlagen" })).toHaveCount(0);
  await boss.goto("/boss/templates");
  await expect(boss.getByText("This page could not be found.")).toBeVisible();
  await boss.goto("/admin/flags");
  await boss.getByRole("switch", { name: "templates" }).click();
  await boss.waitForTimeout(800);

  // Landing-Text überschreiben
  await boss.goto("/admin/content");
  const area = boss.locator("textarea").first();
  await area.fill(JSON.stringify({ hero: { title: "Test-Titel aus der Admin-Seite" } }));
  await boss.getByRole("button", { name: "Speichern" }).nth(2).click();
  await boss.waitForTimeout(800);
  const guest = await browser.newPage();
  await guest.goto("/?lang=de");
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("Test-Titel aus der Admin-Seite");
  // zurücksetzen (andere Tests erwarten Standardtexte)
  await boss.goto("/admin/content");
  await boss.locator("textarea").first().fill("{}");
  await boss.getByRole("button", { name: "Speichern" }).nth(2).click();
  await boss.waitForTimeout(800);
});

test("Mitarbeiter erreicht /admin nicht", async ({ browser }) => {
  const staff = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  await staff.goto("/admin");
  await expect(staff.getByText("This page could not be found.")).toBeVisible();
  await expect(staff.getByText("Firmen gesamt")).toHaveCount(0);
});
