import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// The hosted sandbox ships Chromium at a fixed path; local machines use the
// Playwright-managed browser. Override with PW_CHROMIUM_PATH if needed.
const sandboxChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath =
  process.env.PW_CHROMIUM_PATH ?? (existsSync(sandboxChromium) ? sandboxChromium : undefined);

const port = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: process.env.PW_NO_BUILD
      ? `npx next start -p ${port}`
      : `npm run build && npx next start -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
