import { expect, test } from "@playwright/test";
import { BUILT_IN } from "@/config/media";

test("a box's picture is picked when a parent taps it and stays through the booking (mock provider)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One full booking is enough; the other projects book in booking.spec.ts");
  // built-in first section: its box shows the middle picture
  const picture = BUILT_IN.sections[0].photos[1];
  let submitted: { inspirationPhotoId?: string } | undefined;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/booking/create")) submitted = request.postDataJSON();
  });

  await page.goto("/");
  await page.getByRole("link", { name: "Book a memory like this one" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/bundles\\?inspiration=${picture.id}$`));
  await expect(page.getByText(`You picked “${picture.title}”`)).toBeVisible();

  const loaded = page.waitForResponse((response) => response.url().includes("/api/booking/availability"));
  await page.getByRole("link", { name: /Choose Little Moments/i }).click();
  await expect(page).toHaveURL(new RegExp(`/book\\?bundle=little-moments&inspiration=${picture.id}$`));
  await loaded;
  await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-busy", "false");
  // every booking step shows the picked picture at the top
  await expect(page.getByText("Inspired by", { exact: true })).toBeVisible();
  await expect(page.getByText(picture.title, { exact: false }).first()).toBeVisible();

  const openDay = page.locator('button[aria-label*="time available"], button[aria-label*="times available"]').first();
  if (!(await openDay.count())) {
    const next = page.waitForResponse((response) => response.url().includes("/api/booking/availability"));
    await page.getByRole("button", { name: "Next month" }).click();
    await next;
  }
  await openDay.click();
  await page.getByRole("button", { name: /Next: Time/ }).click();
  await page.locator('label[for^="time-"]').first().click();
  await page.getByRole("button", { name: /Next: Details/ }).click();
  await expect(page.getByText("Inspired by", { exact: true })).toBeVisible();
  await page.fill("#field-parentName", "Role Model Test");
  await page.fill("#field-email", "role.model@example.com");
  await page.fill("#field-phone", "3055550199");
  await page.fill("#field-street", "1500 Bay Rd");
  await page.fill("#field-city", "Miami Beach");
  await page.fill("#field-zip", "33139");
  await page.selectOption("#field-babyAge", { index: 1 });
  await page.getByRole("button", { name: /Next: Review/ }).click();
  await expect(page.locator("dl").getByText(picture.title, { exact: true })).toBeVisible();

  // the server refuses bookings finished in under 4 seconds (spam check)
  await page.waitForTimeout(4500);
  await page.getByRole("button", { name: /Book my session/ }).click();
  await expect(page.getByText("Booking confirmed")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Inspiration saved:")).toBeVisible();
  expect(submitted?.inspirationPhotoId).toBe(picture.id);
});
