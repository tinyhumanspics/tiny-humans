import { expect, test } from "@playwright/test";

/** The chalk logo intro: on the home page, every time it is opened or reloaded (owner, Nov 23). */
// the full drawing, not the short reduced-motion version the rest of the suite runs with
test.use({ reducedMotion: "no-preference" });

test("the intro plays on the home page, and again on every reload", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  for (const visit of ["first visit", "reload", "second reload"]) {
    if (visit !== "first visit") await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html"), visit).toHaveAttribute("data-intro", /.+/);
    await expect(page.locator("html"), visit).not.toHaveAttribute("data-intro", /.+/, { timeout: 15_000 });
  }
});

test("no intro on Book, Bundles or About", async ({ page }) => {
  for (const path of ["/book", "/bundles", "/about", "/es/bundles"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(await page.locator("html").getAttribute("data-intro"), path).toBeNull();
  }
});
