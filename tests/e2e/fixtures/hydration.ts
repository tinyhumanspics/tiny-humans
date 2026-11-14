import type { Page } from "@playwright/test";

/**
 * Waits until React has hydrated the box. WebKit lets a test type into a server-rendered box right after the page
 * loads; hydration then puts the box back to its empty state (CI, Nov 14: a due date and a unit number lost this way).
 */
export async function hydrated(page: Page, selector: string) {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return Boolean(el && Object.keys(el).some((key) => key.startsWith("__reactProps$")));
  }, selector);
}
