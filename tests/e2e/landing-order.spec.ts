import { expect, test } from "@playwright/test";

/** The ad page lists the bundles cheapest first on every screen, phones too (owner, Nov 13). */
test("ad page: bundles from the cheapest to the most expensive, on phones and desktops", async ({ page }) => {
  await page.goto("/home-sweet-home");
  const section = page.locator("#bundles");
  await section.scrollIntoViewIfNeeded();
  const cards = section.getByRole("heading", { level: 3 });
  await expect(cards.first()).toBeVisible();
  // in the order a visitor sees them: top to bottom, then left to right
  const seen = await cards.evaluateAll((hs) =>
    hs
      .map((h) => ({ name: h.textContent?.trim() ?? "", r: h.getBoundingClientRect() }))
      // cards side by side are one row (the "Most loved" card sits a little lower)
      .sort((a, b) => (Math.abs(a.r.top - b.r.top) < 120 ? a.r.left - b.r.left : a.r.top - b.r.top))
      .map((x) => x.name),
  );
  expect(seen.slice(0, 3)).toEqual(["Little Moments", "Our Little Story", "Our Family Story"]);
});
