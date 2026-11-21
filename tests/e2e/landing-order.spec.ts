import { expect, test, type Page } from "@playwright/test";

/** The ad page lists the bundles cheapest first on every screen, phones too (owner, Nov 13). */
async function bundleNames(page: Page, path: string, level: 2 | 3) {
  await page.goto(path);
  const section = page.locator("#bundles");
  await section.scrollIntoViewIfNeeded();
  // each bundle card's name (the section has other headings too)
  const cards = section.locator("article").getByRole("heading", { level });
  await expect(cards.first()).toBeVisible();
  // in the order a visitor sees them: top to bottom, then left to right
  return cards.evaluateAll((hs) =>
    hs
      .map((h) => ({ name: h.textContent?.trim() ?? "", r: h.getBoundingClientRect() }))
      // cards side by side are one row (the "Most loved" card sits a little lower)
      .sort((a, b) => (Math.abs(a.r.top - b.r.top) < 120 ? a.r.left - b.r.left : a.r.top - b.r.top))
      .map((x) => x.name),
  );
}

test("ad page: bundles from the cheapest to the most expensive, on phones and desktops", async ({ page }) => {
  expect(await bundleNames(page, "/home-sweet-home", 3)).toEqual(["Little Moments", "Our Little Story", "Our Family Story"]);
});

/** The bundles page shows the same tiers in the same order as the ad page (brief 05). */
test("bundles page: the ad page's bundles in the same order", async ({ page }) => {
  const landing = await bundleNames(page, "/home-sweet-home", 3);
  expect(await bundleNames(page, "/bundles", 2)).toEqual(landing);
});
