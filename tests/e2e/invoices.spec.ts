import { expect, test } from "@playwright/test";
import { loginAs, newGuest, resetDemo } from "./helpers";

test("Rechnung: ausstellen (GoBD), PDF/XRechnung, bezahlt, Storno; Angebot per Link annehmen", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await resetDemo(boss);
  await boss.getByRole("button", { name: /Anna Becker/ }).click();
  await boss.waitForURL(/boss/);
  boss.on("dialog", (d) => d.accept(d.type() === "prompt" ? "Falscher Betrag" : undefined));
  const year = new Date().getFullYear();

  await boss.goto("/boss/invoices");
  await boss.getByRole("link", { name: /Hausverwaltung Schmidt/ }).click();
  await expect(boss.getByRole("heading", { name: /Rechnung \(Entwurf\)/ })).toBeVisible();
  await boss.getByRole("button", { name: "Rechnung ausstellen" }).click();
  await expect(boss.getByRole("heading", { name: `Rechnung RE-${year}-0001` })).toBeVisible();
  await expect(boss.getByText(/unveränderlich \(GoBD\)/)).toBeVisible();
  const id = boss.url().split("/").pop()!;
  const pdf = await boss.request.get(`/api/invoices/${id}/pdf`);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const xml = await (await boss.request.get(`/api/invoices/${id}/xml`)).text();
  expect(xml).toContain(`<ram:ID>RE-${year}-0001</ram:ID>`);
  expect(xml).toContain("<ram:GrandTotalAmount>214.20</ram:GrandTotalAmount>"); // 180 € + 19 %

  await boss.getByRole("button", { name: "Als bezahlt markieren" }).click();
  await expect(boss.getByText("Bezahlt", { exact: true })).toBeVisible();
  await boss.getByRole("button", { name: "Stornieren" }).click();
  await expect(boss.getByRole("heading", { name: `Stornorechnung RE-${year}-0002` })).toBeVisible();
  await expect(boss.getByText(`Storniert Rechnung RE-${year}-0001`)).toBeVisible();

  // Neue Rechnung aus abgenommener Aufgabe
  await boss.goto("/boss/tasks/00000000-0000-4000-8000-000000000408");
  await boss.getByRole("button", { name: "Rechnung erstellen" }).click();
  await expect(boss.getByRole("heading", { name: /Rechnung \(Entwurf\)/ })).toBeVisible();
  await expect(boss.getByLabel("Beschreibung").first()).toHaveValue("Malerarbeiten Flur");

  // Angebot: Kunde nimmt per Link an → Kunde + Aufgabe entstehen
  await boss.goto("/boss/invoices?tab=offers");
  await boss.getByRole("link", { name: /Grundreinigung Büro 3\. OG/ }).click();
  const link = await boss.getByRole("textbox").first().inputValue();
  const guest = await newGuest(browser);
  await guest.goto(new URL(link).pathname);
  await expect(guest.getByRole("heading", { name: `Angebot AN-${year}-0001` })).toBeVisible();
  await guest.getByLabel("Ihr Name").fill("Dr. Weiß");
  await guest.getByLabel("Ich nehme das Angebot verbindlich an.").check();
  await guest.getByRole("button", { name: "Angebot annehmen" }).click();
  await expect(guest.getByText(/Das Angebot wurde angenommen/)).toBeVisible();
  await boss.reload();
  await expect(boss.getByText("Angenommen von Dr. Weiß", { exact: false })).toBeVisible();
  await boss.getByRole("link", { name: "Zur Aufgabe" }).click();
  await expect(boss.getByRole("heading", { name: "Grundreinigung Büro 3. OG" })).toBeVisible();

  // Mitarbeiter: kein Zugriff
  const dmitri = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  expect((await dmitri.request.get(`/api/invoices/${id}/pdf`)).status()).toBe(403);
  await resetDemo(boss);
});
