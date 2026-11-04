import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("Rechtstexte mit Platzhaltern + Cookie-Hinweis", async ({ page }) => {
  for (const [path, title] of [["/impressum", "Impressum"], ["/datenschutz", "Datenschutzerklärung"], ["/agb", "Allgemeine Geschäftsbedingungen"], ["/avv", "Auftragsverarbeitungsvertrag"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  }
  await page.goto("/datenschutz");
  await expect(page.getByText("[EMAIL]").first()).toBeVisible();
  await expect(page.getByText(/Supabase Inc\./).first()).toBeVisible();
  // Cookie-Hinweis: nur notwendige, bleibt nach Bestätigung weg
  await page.getByRole("button", { name: "Verstanden" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Verstanden" })).toHaveCount(0);
});

test("Mitarbeiter lädt eigene Daten, Chef exportiert ZIP", async ({ browser }) => {
  const staff = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  const me = await staff.request.get("/api/export/me");
  expect(me.status()).toBe(200);
  const json = await me.json();
  expect(json.profile.full_name).toBe("Dmitri Iwanow");
  expect(JSON.stringify(json)).not.toContain("client_price");
  expect((await staff.request.get("/api/export/firm")).status()).toBe(403);

  const boss = await loginAs(browser, /Anna Becker/);
  const zip = await boss.request.get("/api/export/firm");
  expect(zip.status()).toBe(200);
  expect(zip.headers()["content-type"]).toBe("application/zip");
  const body = await zip.body();
  expect(body.subarray(0, 2).toString()).toBe("PK");
});
