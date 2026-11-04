import { expect, test } from "@playwright/test";
import { loginAs, newGuest, resetDemo } from "./helpers";

const TOKEN = "d3m0".repeat(16);

test("Kunden-Link: Status, Abnahme, Bewertung; Widerruf; Mitarbeiter ohne Kundenzugriff", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await resetDemo(boss);
  await boss.getByRole("button", { name: /Anna Becker/ }).click();
  await boss.waitForURL(/boss/);

  const guest = await newGuest(browser);
  await guest.goto(`/c/${TOKEN}`);
  await expect(guest.getByRole("heading", { name: "Badfliesen verfugen" })).toBeVisible();
  expect(await guest.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  await guest.getByRole("button", { name: "Arbeit abnehmen" }).click();
  await expect(guest.getByText("Arbeit abgenommen – vielen Dank!")).toBeVisible();
  await guest.getByRole("radio", { name: "5/5" }).click();
  await guest.getByPlaceholder("Kommentar (optional)").fill("Sehr sauber gearbeitet!");
  await guest.getByRole("button", { name: "Bewertung senden" }).click();
  await expect(guest.getByText("Danke für Ihre Bewertung!")).toBeVisible();

  // Chef sieht Abnahme + Bewertung beim Kunden
  await boss.goto("/boss/clients");
  await boss.getByRole("link", { name: /Hausverwaltung Schmidt/ }).click();
  await expect(boss.getByText("Sehr sauber gearbeitet!")).toBeVisible();

  // Link widerrufen → ungültig
  await boss.goto("/boss/tasks/00000000-0000-4000-8000-000000000405");
  await boss.getByRole("button", { name: "Widerrufen" }).click();
  await boss.waitForTimeout(800);
  await guest.goto(`/c/${TOKEN}`);
  await expect(guest.getByText("Dieser Link ist ungültig oder abgelaufen.")).toBeVisible();

  // Mitarbeiter: keine Kunden
  const staff = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  await staff.goto("/boss/clients");
  await expect(staff).toHaveURL(/staff\/today/);
});

test("Öffentliche Anfrage → Kunde + Aufgabe", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await resetDemo(boss);
  await boss.getByRole("button", { name: /Anna Becker/ }).click();
  await boss.waitForURL(/boss/);
  await boss.goto("/boss/settings");
  await boss.getByRole("switch", { name: "Öffentliche Anfrage-Seite" }).click();
  await boss.waitForTimeout(800);

  const guest = await newGuest(browser);
  await guest.goto("/f/glanz-bau");
  await guest.getByLabel("Ihr Name").fill("Peter Neu");
  await guest.getByLabel("Telefon oder E-Mail").fill("peter@example.com");
  await guest.getByLabel("Was soll gemacht werden?").fill("Fenster im Laden putzen");
  await guest.waitForTimeout(3200); // Mindest-Ausfüllzeit (Bot-Schutz)
  await guest.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(guest.getByText("Danke! Ihre Anfrage ist angekommen.")).toBeVisible();

  await boss.goto("/boss/requests");
  const card = boss.locator("div.card-white", { hasText: "Fenster im Laden putzen" });
  await card.getByRole("button", { name: "In Kunde + Aufgabe umwandeln" }).click();
  await boss.waitForURL(/boss\/tasks\/[0-9a-f-]{36}$/);
  await expect(boss.getByRole("heading", { name: "Fenster im Laden putzen" })).toBeVisible();
  await resetDemo(boss);
});
