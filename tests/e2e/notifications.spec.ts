import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("Benachrichtigungen pro Typ bleiben gespeichert; Einladung per E-Mail möglich", async ({ browser }) => {
  const boss = await loginAs(browser, /Anna Becker/);
  await boss.goto("/boss/settings");
  const sw = boss.getByRole("switch", { name: "Neue Bewertungen" });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click();
  await boss.waitForTimeout(600);
  await boss.reload();
  await expect(boss.getByRole("switch", { name: "Neue Bewertungen" })).toHaveAttribute("aria-checked", "false");
  await boss.getByRole("switch", { name: "Neue Bewertungen" }).click();

  await boss.goto("/boss/employees");
  await expect(boss.getByPlaceholder("E-Mail").first()).toBeVisible();

  const staff = await loginAs(browser, /Dmitri Iwanow/, { mobile: true });
  await staff.goto("/staff/profile");
  await expect(staff.getByText("Neue Aufgaben werden immer gemeldet.")).toBeVisible();
  await expect(staff.getByRole("switch", { name: "Erinnerung 1 h vor Termin" })).toBeVisible();
});
