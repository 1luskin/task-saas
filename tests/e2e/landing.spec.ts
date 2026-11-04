import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("Landingpage für Gäste (DE/RU), ohne Bewertungen-Block, SEO-Dateien", async ({ page, request }) => {
  await page.goto("/?lang=de");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aufgaben, Zeiten und Löhne. In einer App.");
  await expect(page.getByRole("link", { name: "Jetzt 14 Tage testen" }).first()).toBeVisible();
  await expect(page.getByText("Das sagen unsere Kunden")).toHaveCount(0); // keine echten Bewertungen → ausgeblendet
  await expect(page.getByRole("link", { name: "Impressum" })).toBeVisible();
  await page.goto("/?lang=ru");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Задачи, время и зарплаты. В одном приложении.");
  await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveCount(1);

  expect((await request.get("/robots.txt")).status()).toBe(200);
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /boss");
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/impressum");
  const og = await request.get("/opengraph-image");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
});

test("Angemeldete werden von / in die App geleitet", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await boss.goto("/");
  await expect(boss).toHaveURL(/\/boss/);
});
