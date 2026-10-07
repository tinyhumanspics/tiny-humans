import { defineConfig, devices } from "@playwright/test";

/** Visual parity screenshots (see tests/visual/parity.spec.ts). Runs the production build locally in mock mode. */
const PORT = 3200;
export default defineConfig({
  testDir: "./tests/visual",
  snapshotPathTemplate: ".screenshots/parity/{projectName}/{arg}{ext}",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: "America/New_York",
    locale: "en-US",
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "iphone-14", use: { ...devices["iPhone 14"], browserName: "chromium" } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { BOOKING_PROVIDER: "mock", NEXT_PUBLIC_META_PIXEL_ID: "", META_CAPI_ACCESS_TOKEN: "" },
  },
});
