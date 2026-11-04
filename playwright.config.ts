import { defineConfig } from "@playwright/test";
import fs from "node:fs";

// Vorinstallierter Chromium (CI/Container) – sonst Playwright-Standard
const executablePath = ["/opt/pw-browsers/chromium/chrome", "/opt/pw-browsers/chromium"].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3123",
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    // E2E läuft immer im Demo-Modus (ohne Supabase-Schlüssel)
    command: "npm run build && npx next start -p 3123",
    url: "http://localhost:3123/login",
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_DEMO_MODE: "1", CRON_SECRET: "e2e-secret" },
  },
});
