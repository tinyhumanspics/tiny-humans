import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { DepositReturnState } from "@/lib/deposit/types";

/**
 * The pay link of a booking the owner confirmed (Requests): the mom's home address, her backdrops, then the deposit.
 * APIs faked (the real flow is checked against scripts/local-db + fake Stripe).
 */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() + 9 * 864e5));
const LINK = "/book?bundle=our-little-story&deposit=TH-20261112-4459&k=sig";

test("the mom's link: her home address (owner, Nov 16), her backdrops (two for Our Little Story), then the deposit opens Stripe", async ({ page }) => {
  const waiting: DepositReturnState = { state: "waiting", amountCents: 5000, holdUntil: new Date(Date.now() + 47 * 3_600_000).toISOString(), date: day, start: "13:00", end: "15:00", bundleName: "Our Little Story", payUrl: null, ownerBooked: true, backdrops: { allowed: 2, picks: [] }, home: { street: "", city: "", zip: "33139", accessNotes: "" } };
  await page.route("**/api/booking/deposit/status?*", (route) => route.fulfill({ json: waiting }));
  const homes: unknown[] = [];
  await page.route("**/api/booking/deposit/home", (route) => {
    const body = route.request().postDataJSON() as { b: string; k: string; home: { street: string; city: string; accessNotes: string } };
    homes.push(body);
    return route.fulfill({ json: { home: { ...body.home, zip: "33139" } } });
  });
  const saved: unknown[] = [];
  await page.route("**/api/booking/deposit/backdrops", (route) => {
    const body = route.request().postDataJSON() as { b: string; k: string; picks: string[] };
    saved.push(body);
    return route.fulfill({ json: { picks: body.picks } });
  });
  await page.route("**/api/booking/deposit/pay", (route) => route.fulfill({ json: { url: "http://localhost:3100/fake-stripe-page" } }));
  await page.route("**/fake-stripe-page", (route) => route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><title>Stripe</title><h1>Stripe page</h1></html>' }));
  await page.goto(LINK);
  await expect(page.getByRole("heading", { name: "We saved your session!" })).toBeVisible();
  await expect(page.getByText("Three quick steps to confirm it: tell us where you live, pick your backdrop, then pay the $50 deposit.", { exact: false })).toBeVisible();
  const pay = page.getByRole("button", { name: "Pay the $50 deposit" });
  await expect(pay).toBeDisabled();
  // 1. her home: no texting the address (the ZIP is the request's)
  await expect(page.getByRole("heading", { name: "1. Your home" })).toBeVisible();
  await expect(page.getByText("ZIP code 33139.", { exact: false })).toBeVisible();
  await expect(page.getByText("Add your home address above first.")).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).first().click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Add your street address and city so we can find you.");
  await page.getByLabel("Street address (and apt or unit)").fill("1500 Bay Rd, Apt 1204");
  await page.getByLabel("City").fill("Miami Beach");
  await page.getByLabel(/Gate code, parking/).fill("Gate 4321");
  await page.getByRole("button", { name: "Save and continue" }).first().click();
  await expect(page.getByText("We'll come to 1500 Bay Rd, Apt 1204, Miami Beach, FL 33139.")).toBeVisible();
  expect(homes).toEqual([{ b: "TH-20261112-4459", k: "sig", home: { street: "1500 Bay Rd, Apt 1204", city: "Miami Beach", accessNotes: "Gate 4321" } }]);
  await expect(pay).toBeDisabled();
  await expect(page.getByRole("heading", { name: "2. Your backdrops" })).toBeVisible();
  const picker = page.getByRole("group", { name: "Pick your backdrops" });
  await picker.getByRole("button").nth(0).click();
  await picker.getByRole("button").nth(4).click();
  // a third one doesn't fit Our Little Story (two setups)
  await picker.getByRole("button").nth(5).click();
  await expect(picker.locator('button[aria-pressed="true"]')).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);

  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText(/^Saved: /)).toBeVisible();
  expect(saved).toEqual([{ b: "TH-20261112-4459", k: "sig", picks: expect.arrayContaining([]) }]);
  expect((saved[0] as { picks: string[] }).picks).toHaveLength(2);
  await expect(page.getByText("Need a different time? Text us at", { exact: false })).toBeVisible();
  await pay.click();
  await page.waitForURL("**/fake-stripe-page");
});

test("the mom's link: “Not sure yet” skips the backdrops; Change brings them back", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-safari", "One phone covers it");
  await page.route("**/api/booking/deposit/status?*", (route) =>
    route.fulfill({ json: { state: "waiting", amountCents: 5000, holdUntil: new Date(Date.now() + 47 * 3_600_000).toISOString(), date: day, start: "09:00", end: "10:00", bundleName: "Little Moments", payUrl: null, ownerBooked: true, backdrops: { allowed: 1, picks: [] }, home: { street: "1500 Bay Rd", city: "Miami Beach", zip: "33139", accessNotes: "" } } }),
  );
  await page.goto("/book?bundle=little-moments&deposit=TH-20261112-0001&k=sig");
  // an address already on the booking (saved on an earlier visit) shows as saved
  await expect(page.getByText("We'll come to 1500 Bay Rd, Miami Beach, FL 33139.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "2. Your backdrop" })).toBeVisible();
  await page.getByRole("button", { name: "Not sure yet, I'll choose later" }).click();
  await expect(page.getByText("No backdrop yet: you can choose it later from your confirmation email.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay the $50 deposit" })).toBeEnabled();
  await page.getByRole("button", { name: "Change" }).last().click();
  await expect(page.getByRole("group", { name: "Pick your backdrop" })).toBeVisible();
});
