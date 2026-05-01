import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for SERVIO golden-path smoke tests.
 *
 * - Local: defaults to http://localhost:5173 and starts the dev server
 *   automatically (reusing an already-running one if present).
 * - CI / against deployed: set E2E_BASE_URL=https://your-vercel-url
 *   and the webServer block is skipped.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const useDevServer = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: useDevServer
    ? {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
