import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginAs, newGuest } from "./helpers";

const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function audit(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const r = await new AxeBuilder({ page }).withTags(RULES).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${path}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`);
}

/** Zonen zum Antippen auf dem Handy: mindestens 44 × 44 px (WCAG 2.5.5 / Apple HIG) (sichtbare Buttons/Links/Felder in main/nav) */
async function smallTargets(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>("main button, main a.btn, main a.btn-primary, main a.btn-secondary, main a.btn-ghost, main input:not([type=checkbox]):not([type=radio]):not([type=hidden]), main select, nav a, nav button").forEach((el) => {
      const r = (el.closest("label") ?? el).getBoundingClientRect(); // Feld in Label: ganzes Label ist antippbar
      const st = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || st.visibility === "hidden" || el.closest("[aria-hidden=true]")) return;
      if (r.height < 44 || r.width < 44) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    });
    return out;
  });
}

test("Barrierefreiheit: keine ernsten axe-Verstöße (Gast, Chef, Mitarbeiter)", async ({ browser }) => {
  const guest = await newGuest(browser);
  const bad: string[] = [];
  for (const p of ["/", "/login", "/impressum"]) bad.push(...(await audit(guest, p)));
  const boss = await loginAs(browser, /Anna Becker/);
  for (const p of ["/boss", "/boss/team", "/boss/money", "/boss/invoices", "/boss/materials", "/boss/settings", "/boss/tasks/00000000-0000-4000-8000-000000000401"]) bad.push(...(await audit(boss, p)));
  const emp = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  for (const p of ["/staff/today", "/staff/tasks/00000000-0000-4000-8000-000000000401", "/staff/team", "/staff/earnings"]) bad.push(...(await audit(emp, p)));
  expect(bad).toEqual([]);
});

test("Handy: Zonen zum Antippen ≥ 44 px (Mitarbeiter-Seiten)", async ({ browser }) => {
  const emp = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  const bad: string[] = [];
  for (const p of ["/staff/today", "/staff/tasks/00000000-0000-4000-8000-000000000401", "/staff/team"]) {
    await emp.goto(p);
    await emp.waitForLoadState("networkidle");
    bad.push(...(await smallTargets(emp)).map((s) => `${p}: ${s}`));
  }
  expect(bad).toEqual([]);
});

test("Handy (Chef): kein horizontales Scrollen der Seite", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/, { mobile: true });
  const bad: string[] = [];
  for (const p of ["/boss", "/boss/calendar", "/boss/employees", "/boss/money", "/boss/team", "/boss/invoices", "/boss/materials", "/boss/settings", "/boss/more", "/boss/tasks/00000000-0000-4000-8000-000000000401"]) {
    await boss.goto(p);
    await boss.waitForLoadState("networkidle");
    const over = await boss.evaluate(() => {
      const w = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth <= w + 1) return null;
      // breitestes Element finden, das nicht in einem eigenen Scroll-Container liegt
      const els = [...document.querySelectorAll<HTMLElement>("body *")].filter((el) => el.getBoundingClientRect().right > w + 1);
      const culprit = els.find((el) => { let p = el.parentElement; while (p) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") return false; p = p.parentElement; } return true; });
      return `${document.documentElement.scrollWidth}px: ${culprit?.tagName.toLowerCase()}.${(culprit?.className ?? "").toString().slice(0, 60)}`;
    });
    if (over) bad.push(`${p} ${over}`);
  }
  expect(bad).toEqual([]);
});
