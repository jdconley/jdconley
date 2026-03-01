import { defineConfig } from "@playwright/test";

const runAgainstWrangler = process.env.E2E_SERVER === "wrangler";
const port = runAgainstWrangler ? 8788 : 4173;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: runAgainstWrangler ? "pnpm run preview:cf:build" : "pnpm run build && pnpm run preview",
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
});
