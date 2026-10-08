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
  await page.getByRole("button", { name: "Pink", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pink", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Next: Review/ }).click();
  await expect(page.getByText("Check everything")).toBeVisible();
  await expect(page.getByText("1500 Bay Rd, Unit 1204, Miami Beach 33139")).toBeVisible();
  await expect(page.getByText("Gate code 4821, guest parking on level 2")).toBeVisible();
  await expect(page.locator("dl").getByText("Pink", { exact: true })).toBeVisible();
  await expect(page.getByText("OK to text you")).toBeVisible();
  await expect(page.getByText("Kept private")).toBeVisible();
  // the server refuses bookings finished in under 4 seconds (spam check): a person is never that fast
  await page.waitForTimeout(4500);
  await page.getByRole("button", { name: /Book my session/ }).click();
  await expect(page.getByText("Booking confirmed")).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
}

test("a family can book a session (mock provider)", async ({ page }) => {
  let submitted: unknown;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/booking/create")) submitted = request.postDataJSON();
  });
  await bookLittleMoments(page);
  expect(submitted).toMatchObject({ locale: "en" });
});

test("twins add full-price time and photos to any bundle", async ({ page }) => {
  await page.goto("/book?bundle=little-moments");
  const day = page.locator('button[aria-label*="times available"]').first();
  if (!(await day.count())) await page.getByRole("button", { name: "Next month" }).click();
  await page.locator('button[aria-label*="times available"]').first().click();
  await page.getByRole("button", { name: /Next: Time/ }).click();
  const time = page.locator('label[for^="time-"]').first();
  await expect(time.getByText(/until/)).toBeVisible();
  await time.click();
  await page.getByRole("button", { name: /Next: Details/ }).click();

  await expect(page.locator("#field-baby-1-name")).toHaveCount(0);
  await expect(page.getByText("Your bundle includes one baby.")).toBeVisible();
  await page.getByRole("button", { name: "Shooting twins or triplets?" }).click();
  await expect(page.getByRole("button", { name: /Twins.*\+\$75.*\+30 min.*\+5 photos/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Triplets.*\+\$150.*\+60 min.*\+10 photos/ })).toBeVisible();
  await page.getByRole("button", { name: /Twins.*\+\$75/ }).click();
  await expect(page.locator("#field-baby-1-name")).toBeVisible();
  await expect(page.getByText(/Each extra baby adds \$75, 30 minutes and 5 edited photos/)).toBeVisible();
  await expect(page.getByText(/Up to 90 minutes total · 13 edited photos/)).toBeVisible();

  await page.fill("#field-parentName", "Twins Test");
  await page.fill("#field-email", "twins.test@example.com");
  await page.fill("#field-phone", "3055550142");
  await page.fill("#field-street", "1500 Bay Rd");
  await page.fill("#field-city", "Miami Beach");
  await page.fill("#field-zip", "33139");
  await page.fill("#field-babyName", "Luna");
  await page.selectOption("#field-babyAge", { index: 1 });
  await page.fill("#field-baby-1-name", "Mia");
  await page.selectOption("#field-baby-1-age", { index: 1 });
  await page.getByRole("button", { name: /Next: Review/ }).click();

  await expect(page.getByText("1 × $75 = $75", { exact: true })).toBeVisible();
  await expect(page.getByText("$224", { exact: true })).toBeVisible();
  await expect(page.getByText(/Luna \(Newborn \(0–2 weeks\)\), Mia \(Newborn \(0–2 weeks\)\)/)).toBeVisible();
});

test("a longer twins or triplets session keeps details and asks for another time only when needed", async ({ page }) => {
  await page.route("**/api/booking/availability?*", async (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get("from")!;
    const multiple = url.searchParams.get("babies") !== "1";
    const slot = multiple
      ? { id: `${date}T14:00`, date, start: "14:00", end: "16:00", label: "2:00 pm" }
      : { id: `${date}T16:00`, date, start: "16:00", end: "17:00", label: "4:00 pm" };
    await route.fulfill({ json: { days: [{ date, slots: [slot] }] } });
  });

  await page.goto("/book?bundle=little-moments");
  await page.locator('button[aria-label*="times available"]').first().click();
  await page.getByRole("button", { name: /Next: Time/ }).click();
  await page.locator('label[for^="time-"]').click();
  await page.getByRole("button", { name: /Next: Details/ }).click();
  await page.fill("#field-parentName", "Saved Parent");
  await page.fill("#field-babyName", "Luna");
  await page.selectOption("#field-babyAge", { index: 1 });
  await page.getByRole("button", { name: "Shooting twins or triplets?" }).click();
  await page.getByRole("button", { name: /Triplets.*\+\$150/ }).click();

  await expect(page.getByText(/previous time doesn't have enough room/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick a time" })).toBeVisible();
  await page.locator('label[for^="time-"]').click();
  await page.getByRole("button", { name: /Next: Details/ }).click();
  await expect(page.locator("#field-parentName")).toHaveValue("Saved Parent");
  await expect(page.locator("#field-babyName")).toHaveValue("Luna");
  await expect(page.getByText("Baby 3", { exact: true })).toBeVisible();
});

test("mock mode previews the confirmation email (React Email rendered in the browser)", async ({ page }) => {
  await bookLittleMoments(page);
  await page.getByRole("button", { name: "Preview the confirmation email" }).click();
  const email = page.frameLocator('iframe[title="English confirmation email preview"]');
  await expect(email.getByRole("heading", { name: /You're booked, José!/ })).toBeVisible();
  await expect(email.getByRole("link", { name: "Reschedule Booking" })).toBeVisible();
  await expect(email.getByText("1500 Bay Rd, Unit 1204, Miami Beach, FL 33139").first()).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Preview the Spanish email" }).click();
  const spanish = page.frameLocator('iframe[title="Spanish confirmation email preview"]');
  await expect(spanish.getByRole("heading", { name: /Tu sesión está reservada, José!/ })).toBeVisible();
  await expect(spanish.getByRole("link", { name: "Cambiar la fecha o la hora" })).toBeVisible();
  await expect(spanish.getByText("Rosa", { exact: true })).toBeVisible();
  await expect(spanish.locator("body")).toContainText(/(?:lunes|martes|miércoles|jueves|viernes|sábado|domingo), \d+ de \w+ de 2026/);
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
