import { expect, test } from "@playwright/test";

/** Owner, Nov 16: the home page is the ad page with "Tiny moments. Big memories."; the portfolio is its own page; the menu has Home. */
test("home: the ad page's layout with its own title and one Check dates", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText(/Tiny moments\.\s*Big memories\./);
  // the home page's own line on top (owner, Nov 16); the ad page keeps "The Stay-Home Session · Miami"
  await expect(page.getByText("Miami to Orlando", { exact: true })).toBeVisible();
  const check = page.locator("main a", { hasText: "Check dates" }).first();
  await expect(check).toHaveAttribute("href", /^\/book\?bundle=/);
  // the same sections as the ad page
  await expect(page.getByRole("heading", { name: "The first weeks are for staying home." })).toBeVisible();
  await expect(page.locator("#bundles")).toHaveCount(1);
});

test("the menu: Home, Portfolio (its own page), Bundles, Book", async ({ page }) => {
  await page.goto("/bundles");
  const nav = page.locator("header nav");
  await expect(nav.locator("a", { hasText: /^Home$/ })).toHaveAttribute("href", "/");
  await expect(nav.locator("a", { hasText: /^Portfolio$/ })).toHaveAttribute("href", "/portfolio");
  await expect(nav.locator("a", { hasText: /^Book$/ })).toHaveAttribute("href", "/book");
});

test("portfolio: only the babies' photos, each opens the viewer, then Check dates", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { level: 1, name: /Little moments/ })).toBeVisible();
  const photos = page.getByRole("button", { name: /Open photo \d+ of/ });
  await expect(photos.first()).toBeVisible();
  await photos.first().click();
  await expect(page.getByRole("dialog", { name: "Photo viewer" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("main a", { hasText: "Check dates" })).toHaveAttribute("href", "/book");
});

test("home and ad page show the same \"Real homes. Real families.\" photos (the ones ticked for the ad page)", async ({ page }) => {
  const photos = async (path: string) => {
    await page.goto(path);
    return page.locator('section[aria-labelledby="landing-work"] img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src")));
  };
  const home = await photos("/");
  expect(home.length).toBeGreaterThan(0);
  expect(home).toEqual(await photos("/home-sweet-home"));
});

test("the ad page keeps its own top line", async ({ page }) => {
  await page.goto("/home-sweet-home");
  await expect(page.getByText("The Stay-Home Session · Miami", { exact: true })).toBeVisible();
  await expect(page.getByText("Miami to Orlando", { exact: true })).toHaveCount(0);
});
