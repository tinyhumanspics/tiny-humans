import { expect, test } from "@playwright/test";

// Instagram's in-app browser on iPhone (most ad clicks open here)
const INSTAGRAM_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 389.0.0.29.87 (iPhone15,2; iOS 18_5; en_US; en; scale=3.00; 1179x2556; 739461213)";

async function bookLittleMoments(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/404|Failed to load resource/.test(m.text()) && errors.push(m.text()));

  await page.goto("/bundles?utm_source=facebook&utm_medium=paid_social&fbclid=TEST");
  await page.getByRole("link", { name: /Choose Little Moments/i }).click();
  await expect(page).toHaveURL(/\/book\?bundle=little-moments/);

  const day = page.locator('button[aria-label*="times available"]').first();
  if (!(await day.count())) await page.getByRole("button", { name: "Next month" }).click();
  await page.locator('button[aria-label*="times available"]').first().click();
  await page.getByRole("button", { name: /Next: Time/ }).click();
  await expect(page.getByText(/Miami time/).first()).toBeVisible();
  await page.locator('label[for^="time-"]').first().click();
  await page.getByRole("button", { name: /Next: Details/ }).click();

  await page.fill("#field-parentName", "José Muñoz");
  await page.fill("#field-email", "jose.test@example.com");
  await page.fill("#field-phone", "(305) 555-0142");
  await page.fill("#field-street", "1500 Bay Rd Apt 1204");
  await page.fill("#field-city", "Miami Beach");
  await page.fill("#field-zip", "33139");
  await page.selectOption("#field-babyAge", { index: 1 });
  await page.getByRole("button", { name: /Next: Review/ }).click();
  await expect(page.getByText("Check everything")).toBeVisible();
  // the server refuses bookings finished in under 4 seconds (spam check): a person is never that fast
  await page.waitForTimeout(4500);
  await page.getByRole("button", { name: /Book my session/ }).click();
  await expect(page.getByText("Booking confirmed")).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
}

test("a family can book a session (mock provider)", async ({ page }) => {
  await bookLittleMoments(page);
});

test("booking works in the Instagram in-app browser", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: INSTAGRAM_UA, viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });
  await bookLittleMoments(await ctx.newPage());
  await ctx.close();
});

test("the landing page and legal pages load", async ({ page }) => {
  for (const path of ["/", "/bundles", "/privacy", "/terms"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
});

test("/book without a bundle: the bundle picked earlier this visit, otherwise the bundles page", async ({ page }) => {
  await page.goto("/book");
  await expect(page).toHaveURL(/\/bundles$/);
  await page.getByRole("link", { name: /Choose Little Moments/i }).click();
  await expect(page).toHaveURL(/\/book\?bundle=little-moments/);
  await page.goto("/book");
  await expect(page).toHaveURL(/\/book\?bundle=little-moments$/);
  await expect(page.getByRole("button", { name: /Next: Time/ })).toBeVisible();
});

test("unknown pages show the chalkboard 404", async ({ page }) => {
  const res = await page.goto("/book/schedule?bundle=little-moments");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /This page wandered off/ })).toBeVisible();
  await page.getByRole("link", { name: "Back to the home page" }).click();
  await expect(page).toHaveURL(/\/$/);
});
