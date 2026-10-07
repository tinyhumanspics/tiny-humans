import { expect, test } from "@playwright/test";

/**
 * Visual parity check for refactors and upgrades (local only, never production).
 * 1. On the old code: `npm run build && npx playwright test -c playwright.visual.config.ts --update-snapshots`
 * 2. On the new code: `npm run build && npx playwright test -c playwright.visual.config.ts`
 * Snapshots live in `.screenshots/parity/` (gitignored). Motion is reduced so captures are stable.
 */
const PAGES = ["/", "/book", "/book/schedule?bundle=little-moments", "/privacy", "/terms", "/cancel", "/reschedule", "/admin"];

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
