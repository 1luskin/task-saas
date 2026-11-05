import { expect, test } from "@playwright/test";
import { loginAs, resetDemo } from "./helpers";

test("Team: Dienstplan, Urlaub, Brett, Tagesbericht, Formular-PDF, Anleitung", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await resetDemo(boss);
  await boss.getByRole("button", { name: /Anna Becker/ }).click();
  await boss.waitForURL(/boss/);

  // Dienstplan: Raster + Tausch zur Genehmigung
  await boss.goto("/boss/team");
  await expect(boss.getByRole("cell", { name: "Dmitri Iwanow" })).toBeVisible();
  await expect(boss.getByText("Dmitri Iwanow → Lukas Weber")).toBeVisible();
  await boss.getByRole("button", { name: "Genehmigen" }).click();
  await expect(boss.getByText("Dmitri Iwanow → Lukas Weber")).toHaveCount(0);

  // Urlaub: offener Antrag genehmigen, Resturlaub sichtbar
  await boss.goto("/boss/team?tab=vacation");
  await expect(boss.getByText("Familienbesuch", { exact: false })).toBeVisible();
  await boss.getByRole("button", { name: "Genehmigen" }).click();
  await expect(boss.getByRole("button", { name: "Genehmigen" })).toHaveCount(0);
  await expect(boss.getByText(/Resturlaub 19 von 24 Tagen/).first()).toBeVisible();

  // Schwarzes Brett: veröffentlichen, Lesestatus
  await boss.goto("/boss/team?tab=board");
  await expect(boss.getByText("Gelesen: 1/3")).toBeVisible();
  await boss.getByLabel("Titel").fill("Betriebsfeier");
  await boss.getByLabel("Text").fill("Freitag ab 16 Uhr im Lager.");
  await boss.getByRole("button", { name: "Veröffentlichen" }).click();
  await expect(boss.getByRole("heading", { name: "Betriebsfeier" })).toBeVisible();

  // Dokumente mit Ablauf
  await boss.goto("/boss/team?tab=docs");
  await expect(boss.getByText("Führerschein Klasse B")).toBeVisible();
  await expect(boss.getByText("läuft bald ab")).toBeVisible();

  // Kalender: Urlaub schraffiert
  await boss.goto("/boss/calendar?view=week");
  await expect(boss.getByText(/OP · Urlaub/).first()).toBeVisible();

  // Mitarbeiter: Brett lesen, Urlaub beantragen, Tagesbericht
  const dmitri = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  await dmitri.goto("/staff/team");
  await expect(dmitri.getByRole("heading", { name: "Betriebsfeier" })).toBeVisible();
  await dmitri.getByRole("button", { name: "Gelesen" }).first().click();
  await expect(dmitri.getByRole("button", { name: "Gelesen" })).toHaveCount(1);
  await expect(dmitri.getByText(/Resturlaub 19 von 24 Tagen/)).toBeVisible();
  await dmitri.getByLabel("Was wurde gemacht?").fill("Haus A komplett, Geländer desinfiziert.");
  await dmitri.getByRole("button", { name: "Senden" }).last().click();
  await expect(dmitri.getByText("Gesendet")).toBeVisible();

  // Anleitung in der Aufgabe + Formular ausfüllen → PDF
  await dmitri.goto("/staff/tasks/00000000-0000-4000-8000-000000000401");
  await expect(dmitri.getByText(/Von oben nach unten arbeiten/)).toBeVisible();
  await dmitri.getByLabel("Formular ausfüllen").selectOption({ label: "Abnahmeprotokoll" });
  await dmitri.getByLabel("Arbeitsbereich sauber hinterlassen").check();
  await dmitri.getByLabel("Zustand").selectOption("Gut");
  await dmitri.getByRole("button", { name: "Formular senden" }).click();
  const link = dmitri.getByRole("link", { name: /Abnahmeprotokoll/ });
  await expect(link).toBeVisible();
  const pdf = await dmitri.request.get((await link.getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // Chef sieht den Tagesbericht
  await boss.goto("/boss/team?tab=reports");
  await expect(boss.getByText("Haus A komplett, Geländer desinfiziert.")).toBeVisible();

  // Import-Seite mit Vorlage
  await boss.goto("/boss/employees/import");
  const tpl = await boss.request.get("/api/import/members-template");
  expect(tpl.status()).toBe(200);
  await resetDemo(boss);
});
