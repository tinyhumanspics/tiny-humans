import { expect, test } from "@playwright/test";

/**
 * Visual parity check for refactors and upgrades (local only, never production).
 * 1. On the old code: `npm run build && npx playwright test -c playwright.visual.config.ts --update-snapshots`
 * 2. On the new code: `npm run build && npx playwright test -c playwright.visual.config.ts`
 * Snapshots live in `.screenshots/parity/` (gitignored). Motion is reduced so captures are stable.
 */
const PAGES = ["/", "/bundles", "/book?bundle=little-moments", "/privacy", "/terms", "/cancel", "/reschedule", "/admin"];

for (const path of PAGES) {
  test(`looks the same: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${path.replace(/[^a-z0-9]+/gi, "_") || "home"}.png`, {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.002,
    });
  });
}

const ELEMENTS = [
  { name: "site-header", path: "/", locator: 'header' },
  { name: "bundle-card", path: "/bundles", locator: 'article[aria-labelledby="bundle-little-moments"]' },
  { name: "booking-step-tracker", path: "/book?bundle=little-moments", locator: 'nav[aria-label="Booking steps"]' },
  { name: "landing-faq", path: "/home-sweet-home", locator: 'section[aria-labelledby="landing-faq"]' },
];

for (const item of ELEMENTS) {
  test(`key component looks the same: ${item.name}`, async ({ page }) => {
    await page.goto(item.path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const component = page.locator(item.locator).first();
    await component.scrollIntoViewIfNeeded();
    if (item.name === "landing-faq") {
      // Locator screenshots scroll tall elements to the viewport top; hide the sticky header so this baseline
      // measures the FAQ itself instead of an unrelated overlay.
      await page.locator("header").evaluate((header) => { header.style.visibility = "hidden"; });
    }
    await expect(component).toHaveScreenshot(`${item.name}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.001,
    });
  });
}
