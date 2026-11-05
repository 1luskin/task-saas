import { expect, test } from "@playwright/test";
import { loginAs, resetDemo } from "./helpers";

test("Geo: Einwilligung, Karte, Route, QR-Aufkleber und -Ziel", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await resetDemo(boss);
  await boss.getByRole("button", { name: /Anna Becker/ }).click();
  await boss.waitForURL(/boss/);
  await boss.goto("/boss/settings");
  await boss.getByRole("switch", { name: "Standort bei Begonnen/Fertig" }).click();
  await boss.waitForTimeout(800);
  await boss.reload();
  await expect(boss.getByRole("combobox", { name: /Geozone/ })).toBeVisible();

  // Karte in der Aufgabe mit Standortpunkt (Demo)
  await boss.goto("/boss/tasks/00000000-0000-4000-8000-000000000401");
  await expect(boss.getByRole("region", { name: "Karte" })).toBeVisible();
  await expect(boss.getByText(/Begonnen · Dmitri Iwanow/)).toBeVisible();

  // QR-Aufkleber + Ziel
  const pdf = await boss.request.get("/api/qr/client/00000000-0000-4000-8000-000000001601");
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  await boss.goto("/q/c/00000000-0000-4000-8000-000000001601");
  await expect(boss).toHaveURL(/boss\/clients\/00000000-0000-4000-8000-000000001601/);

  // Mitarbeiterin ohne Einwilligung sieht die Frage; Route mit Navigations-Links
  const lukas = await loginAs(browser, /Lukas Weber/, { mobile: true });
  await expect(lukas.getByText("Standort bei Arbeitsbeginn und -ende?")).toBeVisible();
  await lukas.getByRole("button", { name: "Nicht erlauben" }).click();
  await expect(lukas.getByText("Standort bei Arbeitsbeginn und -ende?")).toHaveCount(0);
  const dmitri = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  await dmitri.goto("/staff/route");
  await expect(dmitri.getByRole("link", { name: "In Google Maps öffnen" })).toHaveAttribute("href", /google\.com\/maps\/dir/);
  await dmitri.goto("/q/c/00000000-0000-4000-8000-000000001601");
  await expect(dmitri).toHaveURL(/staff\/scan\?client=/);
  await expect(dmitri.getByText("Treppenhaus reinigen – Haus A")).toBeVisible();
  await resetDemo(boss);
});
