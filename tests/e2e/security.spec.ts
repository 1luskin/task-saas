import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("Sicherheits-Header und keine CSP-Verstöße", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  const violations: string[] = [];
  boss.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
  const res = await boss.goto("/boss");
  const h = res!.headers();
  expect(h["content-security-policy"]).toContain("nonce-");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["permissions-policy"]).toContain("geolocation=(self)");
  await boss.goto("/boss/tasks/00000000-0000-4000-8000-000000000402");
  await boss.waitForLoadState("networkidle");
  expect(violations).toEqual([]);
});

test("Mitarbeiter: keine fremden Aufgaben, keine Finanzen, keine Chef-Seiten", async ({ browser }) => {
  const staff = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  // Aufgabe von Lukas: "nicht gefunden" (Status kann wegen Streaming/loading.tsx 200 sein), Inhalt nie sichtbar
  await staff.goto("/staff/tasks/00000000-0000-4000-8000-000000000404");
  await expect(staff.getByText("This page could not be found.")).toBeVisible();
  await expect(staff.getByText("Trockenbauwand Küche stellen")).toHaveCount(0);
  await staff.goto("/boss/money");
  await expect(staff).toHaveURL(/staff\/today/);
  expect((await staff.request.get("/api/export/month")).status()).toBe(403);
  expect((await staff.request.get("/api/reports/weekly-pdf")).status()).toBe(403);
});

test("Cron ohne Geheimnis abgewiesen", async ({ request }) => {
  expect((await request.get("/api/cron/daily")).status()).toBe(401);
  expect((await request.get("/api/cron/frequent")).status()).toBe(401);
  expect((await request.get("/api/cron/frequent", { headers: { authorization: "Bearer e2e-secret" } })).status()).toBe(200);
});
