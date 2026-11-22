import { expect, test } from "@playwright/test";

/** The chalk logo intro: only on the home page, at most once per visitor (brief 05). */
// the full drawing, not the short reduced-motion version the rest of the suite runs with
test.use({ reducedMotion: "no-preference" });

test("the intro plays on a visitor's first home page, then never again", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-intro", /.+/);
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", /.+/, { timeout: 15_000 });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(await page.locator("html").getAttribute("data-intro")).toBeNull();
});

test("no intro on Book, Bundles or About, even on a first visit", async ({ page }) => {
  for (const path of ["/book", "/bundles", "/about", "/es/bundles"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(await page.locator("html").getAttribute("data-intro"), path).toBeNull();
  }
  // those visits don't use up the home page's one intro
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-intro", /.+/);
});
