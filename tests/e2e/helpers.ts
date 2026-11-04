import type { Browser, Page } from "@playwright/test";

/** Im Demo-Modus als Person anmelden (Rollenauswahl auf /login) */
export async function loginAs(browser: Browser, name: RegExp, opts: { mobile?: boolean; locale?: "de" | "ru" } = {}): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: opts.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    locale: opts.locale ?? "de",
  });
  await ctx.addCookies([{ name: "locale", value: opts.locale ?? "de", url: "http://localhost:3123" }]);
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByRole("button", { name }).click();
  await page.waitForURL(/\/(boss|staff)/);
  return page;
}

export async function resetDemo(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /zurücksetzen|Сбросить/ }).click();
  await page.waitForURL(/\/login/);
}
