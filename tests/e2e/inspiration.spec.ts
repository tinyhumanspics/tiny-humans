import { expect, test } from "@playwright/test";
import { BUILT_IN } from "@/config/media";

test("a parent opens a gallery picture, uses it as their inspiration, and it stays through the booking (owner, Nov 11)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One full booking is enough; the other projects book in booking.spec.ts");
  // the second picture of the one "Little moments" gallery (no boxes any more)
  const picture = BUILT_IN.sections.flatMap((s) => s.photos)[1];
  let submitted: { inspirationPhotoId?: string } | undefined;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/booking/create")) submitted = request.postDataJSON();
  });

  await page.goto("/");
  await expect(page.getByText("Tap any picture to see it whole, and use it as the inspiration for your session.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Book a memory like this one" })).toHaveCount(0);
  await page.getByRole("button", { name: new RegExp(`^Open photo 2 of \\d+: `) }).click();
  const viewer = page.getByRole("dialog", { name: "Photo viewer" });
  await expect(viewer.getByRole("img", { name: picture.alt })).toBeVisible();
  await viewer.getByRole("link", { name: "Use this one as my inspiration" }).click();
  await expect(page).toHaveURL(new RegExp(`/bundles\\?inspiration=${picture.id}$`));
  await expect(page.getByText(`You picked “${picture.title}”`)).toBeVisible();

  await page.getByRole("link", { name: /Choose Little Moments/i }).click();
  await expect(page).toHaveURL(new RegExp(`/book\\?bundle=little-moments&inspiration=${picture.id}$`));
  // every booking step shows the picked picture at the top
  await expect(page.getByText("Inspired by", { exact: true })).toBeVisible();
  await expect(page.getByText(picture.title, { exact: false }).first()).toBeVisible();
  // step 1: about you (owner, Nov 10), then the calendar
  await page.fill("#field-parentName", "Role Model Test");
  await page.fill("#field-email", "role.model@example.com");
  await page.fill("#field-phone", "3055550199");
  await page.fill("#field-street", "1500 Bay Rd");
  await page.fill("#field-city", "Miami Beach");
  await page.fill("#field-zip", "33139");
  const loaded = page.waitForResponse((response) => response.url().includes("/api/booking/availability"));
  await page.getByRole("button", { name: /Next: Date/ }).click();
  await loaded;
  await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-busy", "false");

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
