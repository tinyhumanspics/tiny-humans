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
  await page.fill("#field-street", "1500 Bay Rd");
  await page.fill("#field-unit", "1204");
  await page.fill("#field-city", "Miami Beach");
  await page.fill("#field-zip", "33139");
  await page.fill("#field-access", "Gate code 4821, guest parking on level 2");
  await page.selectOption("#field-babyAge", { index: 1 });
  // optional permissions: both start unticked
  await expect(page.locator("#field-consent-sms")).not.toBeChecked();
  await expect(page.locator("#field-consent-photos")).not.toBeChecked();
  await page.locator("#field-consent-sms").check();
  // optional backdrop (Little Moments: 1 setup)
  await page.getByRole("button", { name: "Burgundy", exact: true }).click();
  await expect(page.getByRole("button", { name: "Burgundy", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Next: Review/ }).click();
  await expect(page.getByText("Check everything")).toBeVisible();
  await expect(page.getByText("1500 Bay Rd, Unit 1204, Miami Beach 33139")).toBeVisible();
  await expect(page.getByText("Gate code 4821, guest parking on level 2")).toBeVisible();
  await expect(page.locator("dl").getByText("Burgundy", { exact: true })).toBeVisible();
  await expect(page.getByText("OK to text you")).toBeVisible();
  await expect(page.getByText("Kept private")).toBeVisible();
  // the server refuses bookings finished in under 4 seconds (spam check): a person is never that fast
  await page.waitForTimeout(4500);
  await page.getByRole("button", { name: /Book my session/ }).click();
  await expect(page.getByText("Booking confirmed")).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
}

test("a family can book a session (mock provider)", async ({ page }) => {
  await bookLittleMoments(page);
});

test("mock mode previews the confirmation email (React Email rendered in the browser)", async ({ page }) => {
  await bookLittleMoments(page);
  await page.getByRole("button", { name: "Preview the confirmation email" }).click();
  const email = page.frameLocator('iframe[title="Confirmation email preview"]');
  await expect(email.getByRole("heading", { name: /You're booked, José!/ })).toBeVisible();
  await expect(email.getByRole("link", { name: "Reschedule Booking" })).toBeVisible();
  await expect(email.getByText("1500 Bay Rd, Unit 1204, Miami Beach, FL 33139").first()).toBeVisible();
});

test("booking works in the Instagram in-app browser", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: INSTAGRAM_UA, viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });
  await bookLittleMoments(await ctx.newPage());
  await ctx.close();
});

test("a ZIP code outside Florida can't be booked", async ({ page }) => {
  await page.goto("/book?bundle=little-moments");
  const day = page.locator('button[aria-label*="times available"]').first();
  if (!(await day.count())) await page.getByRole("button", { name: "Next month" }).click();
  await page.locator('button[aria-label*="times available"]').first().click();
  await page.getByRole("button", { name: /Next: Time/ }).click();
  await page.locator('label[for^="time-"]').first().click();
  await page.getByRole("button", { name: /Next: Details/ }).click();
  await page.fill("#field-parentName", "Ana Test");
  await page.fill("#field-email", "ana.test@example.com");
  await page.fill("#field-phone", "(305) 555-0142");
  await page.fill("#field-street", "100 Peachtree St");
  await page.fill("#field-city", "Atlanta");
  await page.fill("#field-zip", "30303");
  await page.selectOption("#field-babyAge", { index: 1 });
  await page.getByRole("button", { name: /Next: Review/ }).click();
  await expect(page.getByText("We only come to homes in Florida. Please check the ZIP code.")).toBeVisible();
  await expect(page.getByText("Check everything")).toHaveCount(0);
});

test("the landing page and legal pages load", async ({ page }) => {
  for (const path of ["/", "/bundles", "/about", "/privacy", "/terms"]) {
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
