import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. NEVER against production: they run a local server in mock booking mode
 * (no real calendar events, no emails). Run: `npm run test:e2e` (first time: `npx playwright install`).
 */
const PORT = 3100;
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: "America/Los_Angeles",
    locale: "en-US",
    trace: "retain-on-failure",
    // sandboxes with a preinstalled Chromium can point at it (PW_CHROMIUM_PATH); normally unset
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
  projects: [
    { name: "iphone-safari", use: { ...devices["iPhone 14"] } },
    { name: "android-chrome", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // a production build: closer to Vercel than `next dev`, no first-compile delays, and Next 16 allows only one
    // `next dev` per project (so it can run next to yours)
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    // mock booking provider + no tracking, whatever .env.local says
    env: { BOOKING_PROVIDER: "mock", NEXT_PUBLIC_META_PIXEL_ID: "", META_CAPI_ACCESS_TOKEN: "" },
  },
});
