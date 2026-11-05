import { expect, test } from "@playwright/test";
import { loginAs, resetDemo } from "./helpers";

test("Analytik: Diagramme, Monatsbericht-PDF, DATEV-Export, Material", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await resetDemo(boss);
  await boss.getByRole("button", { name: /Anna Becker/ }).click();
  await boss.waitForURL(/boss/);

  // Dashboard: 2 Diagramme
  await expect(boss.getByText("Abgenommene Aufgaben pro Woche")).toBeVisible();
  await expect(boss.getByText("Gewinn pro Woche")).toBeVisible();

  // Geld: 4 Diagramme, Tabellenansicht, DATEV, Monatsbericht
  await boss.goto("/boss/money");
  await expect(boss.getByText("Kosten pro Woche")).toBeVisible();
  await expect(boss.getByText(/Top-Mitarbeiter/)).toBeVisible();
  await expect(boss.getByText("Lohn", { exact: true }).first()).toBeVisible(); // Legende (2 Reihen)
  const datev = boss.getByRole("link", { name: "DATEV-Export" });
  await expect(datev).toBeVisible();
  const csv = await boss.request.get((await datev.getAttribute("href"))!);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("windows-1252");
  const body = (await csv.body()).toString("latin1");
  expect(body.startsWith('"EXTF";700;21;"Buchungsstapel"')).toBe(true);
  expect(body).toContain("Umsatz (ohne Soll/Haben-Kz)");

  const pdfLink = boss.getByRole("link", { name: "PDF" }).first();
  const pdf = await boss.request.get((await pdfLink.getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // Material: Warnung, Zugang hebt sie auf
  await boss.goto("/boss/materials");
  const row = boss.locator("div.space-y-2", { hasText: "Fugenmörtel grau 5 kg" }).first();
  await expect(row.getByText("geht zur Neige")).toBeVisible();
  await row.getByLabel("Menge").fill("10");
  await row.getByRole("button", { name: "Buchen" }).click();
  await expect(row.getByText("geht zur Neige")).toHaveCount(0);
  await expect(row.getByText("13 Sack")).toBeVisible();

  // Mitarbeiter entnimmt Material auf seine Aufgabe → Ausgabe der Aufgabe
  const dmitri = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  await dmitri.goto("/staff/tasks/00000000-0000-4000-8000-000000000401");
  await dmitri.getByLabel("Material entnehmen").selectOption({ label: "Allzweckreiniger 10 l (6 Kanister)" });
  await dmitri.getByLabel(/^Menge/).fill("2");
  await dmitri.getByRole("button", { name: "Buchen" }).click();
  await expect(dmitri.getByText("Verbrauchtes Material")).toBeVisible();
  await expect(dmitri.getByText("Allzweckreiniger 10 l × 2 Kanister")).toBeVisible();
  await dmitri.getByLabel(/^Menge/).fill("50");
  await dmitri.getByLabel("Material entnehmen").selectOption({ label: "Allzweckreiniger 10 l (4 Kanister)" });
  await dmitri.getByRole("button", { name: "Buchen" }).click();
  await expect(dmitri.getByText("Nicht genug auf Lager.")).toBeVisible();

  // Mitarbeiter: eigener Monatsbericht, aber kein fremder
  const own = await dmitri.request.get("/api/reports/member-pdf");
  expect(own.status()).toBe(200);
  const csvDenied = await dmitri.request.get("/api/export/datev");
  expect(csvDenied.status()).toBe(403);

  // Einstellungen: Buchhaltung
  await boss.goto("/boss/settings");
  await expect(boss.getByRole("heading", { name: "Buchhaltung & DATEV" })).toBeVisible();
  await resetDemo(boss);
});
