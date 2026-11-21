import { expect, test } from "@playwright/test";

// Customer pages around a booking (manage links, shells) and the site's general pages. The booking request itself
// (/book) is covered by book-request.spec.ts.

test("management links: reschedule shows the session, and cancel asks for a reason (APIs faked)", async ({ page }) => {
  const booking = { reference: "TH-20261201-0001", bundleId: "little-moments", bundleName: "Little Moments", date: "2026-12-01", start: "09:00", end: "10:00", parentFirstName: "Ana", status: "active" as const };
  await page.route("**/api/booking/manage?*", (r) => r.fulfill({ json: { booking: { ...booking, location: "1500 Bay Rd, Miami Beach, FL 33139", canReschedule: true, rescheduleNoticeHours: 48 } } }));
  await page.route("**/api/booking/manage/availability?*", (r) => r.fulfill({ json: { days: [] } }));
  await page.goto("/reschedule?t=test-token-0123456789abcdef");
  await expect(page.getByRole("heading", { name: "Reschedule your session" })).toBeVisible();
  await expect(page.getByText("Your Current Session")).toBeVisible();
  await expect(page.getByText("Little Moments", { exact: true })).toBeVisible();

  let reason = "";
  await page.route("**/api/booking/cancel*", async (r) => {
    const summary = { ...booking, canCancel: true, noticeHours: 48 };
    if (r.request().method() === "GET") return r.fulfill({ json: { booking: summary } });
    reason = (r.request().postDataJSON() as { reason: string }).reason;
    return r.fulfill({ json: { booking: { ...summary, status: "cancelled", canCancel: false } } });
  });
  await page.goto("/cancel?t=test-token-0123456789abcdef");
  await expect(page.getByRole("heading", { name: "Cancel your session?" })).toBeVisible();
  await page.fill("#cancel-reason", "Our plans changed");
  await page.getByRole("button", { name: "Confirm Cancellation" }).click();
  await expect(page.getByRole("heading", { name: "Your session has been cancelled" })).toBeVisible();
  expect(reason).toBe("Our plans changed");
});

test("email-linked customer tool shells load safely", async ({ page }, testInfo) => {
  await page.goto("/backdrop");
  await expect(page.getByRole("heading", { name: "Prepare for your session" })).toBeVisible();
  await expect(page.getByText(/This link isn't valid anymore/)).toBeVisible();
  if (process.env.CAPTURE_CUSTOMER_TOOLS === "1") await page.screenshot({ path: `.screenshots/customer-tools-i18n/backdrop-${testInfo.project.name}.png`, fullPage: true });

  await page.goto("/review");
  const reviewError = page.getByRole("region", { name: "We couldn't open this link" });
  await expect(reviewError.getByRole("heading", { name: "We couldn't open this link" })).toBeVisible();
  await expect(reviewError.getByText(/review link isn't valid anymore/)).toBeVisible();
  if (process.env.CAPTURE_CUSTOMER_TOOLS === "1") await page.screenshot({ path: `.screenshots/customer-tools-i18n/review-${testInfo.project.name}.png`, fullPage: true });

  await page.goto("/pay/status?s=paid");
  await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible();
  await expect(page.getByText("Your payment is complete. We can't wait for you to see your photos.")).toBeVisible();
  if (process.env.CAPTURE_CUSTOMER_TOOLS === "1") await page.screenshot({ path: `.screenshots/customer-tools-i18n/pay-${testInfo.project.name}.png`, fullPage: true });
});

test("the landing page and legal pages load", async ({ page }) => {
  for (const path of ["/", "/home-sweet-home", "/bundles", "/about", "/privacy", "/terms"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
});

test("the home portfolio viewer keeps its localized controls", async ({ page }) => {
  await page.goto("/portfolio");
  // Opened from the keyboard: closing must put focus back on the same photo (WCAG 2.4.3).
  const opener = page.getByRole("button", { name: /Open photo 1 of/ });
  await opener.focus();
  await page.keyboard.press("Enter");
  const viewer = page.getByRole("dialog", { name: "Photo viewer" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText(/^1 of \d+$/)).toBeVisible();
  await viewer.getByRole("button", { name: "Next photo" }).click();
  await expect(viewer.getByText(/^2 of \d+$/)).toBeVisible();
  await viewer.getByRole("button", { name: "Close photo viewer" }).click();
  await expect(viewer).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("the About photo placeholder has customer-facing accessible copy", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("img", { name: "Photo coming soon: Adrian & Alondra" })).toBeVisible();
  await expect(page.getByText("photo coming soon").first()).toBeVisible();
});

test("unknown pages show the chalkboard 404", async ({ page }) => {
  const res = await page.goto("/book/schedule?bundle=little-moments");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /This page wandered off/ })).toBeVisible();
  await page.getByRole("link", { name: "Back to the home page" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("brief 04: the retired pages are gone (no redirects, on purpose)", async ({ page }) => {
  for (const path of ["/quick", "/due-date", "/due-date/done", "/feedback", "/unsubscribe", "/admin/unfinished"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
});
