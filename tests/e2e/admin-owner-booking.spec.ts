import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { DepositReturnState } from "@/lib/deposit/types";
import { signedInAdmin } from "./fixtures/admin";

/**
 * /admin → Quotes / Booking (owner, Nov 12): the owner books a session for a mom who texted; the mom's link asks for her
 * backdrops, then the deposit. APIs faked (the real flow is checked against scripts/local-db + fake Stripe).
 */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() + 9 * 864e5));
const LINK = "/book?bundle=our-little-story&deposit=TH-20261112-4459&k=sig";

test("Quotes / Booking: fill in the family, pick a time, book it; the link and a text to copy", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await signedInAdmin(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const asked: string[] = [];
  await page.route("**/api/admin/booking/slots?*", (route) => {
    asked.push(new URL(route.request().url()).search);
    return route.fulfill({ json: { days: [{ date: day, slots: [{ id: `${day}T09:00`, date: day, start: "09:00", end: "11:00", label: "9:00 AM" }, { id: `${day}T13:00`, date: day, start: "13:00", end: "15:00", label: "1:00 PM" }] }] } });
  });
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/admin/booking", (route) => {
    sent = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({
      status: 201,
      json: { reference: "TH-20261112-4459", status: "pending", url: `http://localhost:3100${LINK}`, holdUntil: new Date(Date.now() + 48 * 3_600_000).toISOString(), sms: `Hi Ana! We saved it: http://localhost:3100${LINK}`, emailed: true, pricing: { totalCents: 29900 }, travel: { feeCents: null, miles: null } },
    });
  });
  await page.goto("/admin/quotes");
  await expect(page.getByRole("navigation", { name: "Owner area" }).getByRole("link", { name: "Quotes / Booking" })).toHaveAttribute("aria-current", "page");
  const form = page.getByRole("region", { name: "Book it for them" });
  await form.getByLabel("Bundle").selectOption({ label: "Our Little Story" });
  await form.getByLabel("Baby's name (optional)").fill("Mia");
  await form.getByLabel("Day").fill(day);
  await form.getByLabel("Their ZIP code").fill("33139");
  await form.getByRole("button", { name: "1:00 PM" }).click();
  expect(asked.at(-1)).toContain("bundle=our-little-story");
  expect(asked.at(-1)).toContain("zip=33139");
  await form.getByLabel("Full name").fill("Ana Rivera");
  await form.getByLabel("Email (their link goes here)").fill("ana@example.com");
  await form.getByLabel("Phone").fill("3055550133");
  await form.getByLabel("Street address").fill("1500 Bay Rd");
  await form.getByLabel("City").fill("Miami Beach");
  await form.getByLabel("What they asked for (optional)").fill("Cream set please");

  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);

  await form.getByRole("button", { name: "Book it and send the link" }).click();
  await expect(form.getByRole("heading", { name: "✓ Booked TH-20261112-4459" })).toBeVisible();
  expect(sent).toMatchObject({
    bundleId: "our-little-story",
    locale: "en",
    slot: { date: day, start: "13:00" },
    babies: [{ age: "Newborn (0–2 weeks)", name: "Mia" }],
    contact: { parentName: "Ana Rivera", email: "ana@example.com", phone: "3055550133", babyAge: "Newborn (0–2 weeks)", babyName: "Mia", notes: "Cream set please" },
    address: { street: "1500 Bay Rd", city: "Miami Beach", zip: "33139" },
    email: true,
  });
  expect(String(sent!.requestId).length).toBeGreaterThan(8);
  await expect(form).toContainText("We emailed them the link.");
  await form.getByRole("button", { name: "Copy their link" }).click();
  await expect(form.getByRole("button", { name: "Link copied ✓" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3100${LINK}`);
  await form.getByRole("button", { name: "Book another family" }).click();
  await expect(form.getByLabel("Full name")).toHaveValue("");
});

test("the mom's link: her backdrops first (two for Our Little Story), then the deposit opens Stripe", async ({ page }) => {
  await page.route("**/api/booking/draft", (r) => r.fulfill({ status: 204 }));
  const waiting: DepositReturnState = { state: "waiting", amountCents: 5000, holdUntil: new Date(Date.now() + 47 * 3_600_000).toISOString(), date: day, start: "13:00", end: "15:00", bundleName: "Our Little Story", payUrl: null, ownerBooked: true, backdrops: { allowed: 2, picks: [] } };
  await page.route("**/api/booking/deposit/status?*", (route) => route.fulfill({ json: waiting }));
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
  await expect(page.getByText("Two quick steps to confirm it: pick your backdrop, then pay the $50 deposit.", { exact: false })).toBeVisible();
  const pay = page.getByRole("button", { name: "Pay the $50 deposit" });
  await expect(pay).toBeDisabled();
  await expect(page.getByRole("heading", { name: "1. Your backdrops" })).toBeVisible();
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
  await page.route("**/api/booking/draft", (r) => r.fulfill({ status: 204 }));
  await page.route("**/api/booking/deposit/status?*", (route) =>
    route.fulfill({ json: { state: "waiting", amountCents: 5000, holdUntil: new Date(Date.now() + 47 * 3_600_000).toISOString(), date: day, start: "09:00", end: "10:00", bundleName: "Little Moments", payUrl: null, ownerBooked: true, backdrops: { allowed: 1, picks: [] } } }),
  );
  await page.goto("/book?bundle=little-moments&deposit=TH-20261112-0001&k=sig");
  await expect(page.getByRole("heading", { name: "1. Your backdrop" })).toBeVisible();
  await page.getByRole("button", { name: "Not sure yet, I'll choose later" }).click();
  await expect(page.getByText("No backdrop yet: you can choose it later from your confirmation email.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay the $50 deposit" })).toBeEnabled();
  await page.getByRole("button", { name: "Change" }).click();
  await expect(page.getByRole("group", { name: "Pick your backdrop" })).toBeVisible();
});
