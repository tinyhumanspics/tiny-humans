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

test("Quotes / Booking: prices by the bundles, your calendar (days off faded), a code's price, book it; the link and a text", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await signedInAdmin(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // the owner's calendar for the month on screen: open every day but Sundays
  const asked: string[] = [];
  await page.route("**/api/admin/booking/slots?*", (route) => {
    const q = new URL(route.request().url()).searchParams;
    asked.push(q.toString());
    const days = [];
    for (let d = new Date(`${q.get("from")}T12:00:00Z`); d <= new Date(`${q.get("to")}T12:00:00Z`); d = new Date(d.getTime() + 864e5)) {
      const date = d.toISOString().slice(0, 10);
      days.push({ date, slots: d.getUTCDay() === 0 ? [] : [{ id: `${date}T09:00`, date, start: "09:00", end: "11:00", label: "9:00 AM" }, { id: `${date}T13:00`, date, start: "13:00", end: "15:00", label: "1:00 PM" }] });
    }
    return route.fulfill({ json: { days } });
  });
  // the price: today's offer, or CHRISTMAS15 when typed (it saves more)
  const quote = { bundleId: "our-little-story", bundleName: "Our Little Story", regularCents: 29900, offerEndsOn: "2026-11-23", addons: [], addonsCents: 0, note: null };
  await page.route("**/api/admin/booking/price?*", (route) => {
    const code = new URL(route.request().url()).searchParams.get("code");
    return route.fulfill({
      json: code
        ? { quote: { ...quote, offerCents: null, offerLabel: null, discountCode: code, discountCents: 4485, finalCents: 25415, totalCents: 25415, pricingType: "discount", note: "Your code gives you a better price than the Thanksgiving Offer, so we've used the code instead." }, travel: { status: "free", miles: 4, feeCents: 0 }, totalCents: 25415, depositCents: 5000 }
        : { quote: { ...quote, offerCents: 26910, offerLabel: "Thanksgiving Offer", discountCode: null, discountCents: 0, finalCents: 26910, totalCents: 26910, pricingType: "offer" }, travel: { status: "free", miles: 4, feeCents: 0 }, totalCents: 26910, depositCents: 5000 },
    });
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
  const bundle = form.getByLabel("Bundle");
  // each bundle with the price a family books at today
  await expect(bundle.locator("option")).toHaveText([/^Little Moments · \$\d/, /^Our Little Story · \$\d/, /^Our Family Story · \$\d/]);
  await bundle.selectOption({ index: 1 });
  await form.getByLabel("Baby's name (optional)").fill("Mia");
  await expect(form.getByText("Add their ZIP code to see your calendar", { exact: false })).toBeVisible();
  await form.getByLabel(/Their ZIP code/).fill("33139");
  const calendar = form.getByRole("grid");
  await expect(calendar).toHaveAttribute("aria-busy", "false");
  expect(asked.at(-1)).toContain("bundle=our-little-story");
  expect(asked.at(-1)).toContain("zip=33139");
  // Sundays are closed: faded, not pickable
  const sundays = calendar.locator('button[aria-label^="Sunday"]');
  if (await sundays.count()) await expect(sundays.first()).toBeDisabled();
  await calendar.locator('button[aria-label*="available"]:not([disabled])').first().click();
  await form.getByRole("button", { name: "1:00 PM" }).click();
  const price = form.locator("#owner-price");
  await expect(price).toContainText("Thanksgiving Offer");
  await expect(price).toContainText("Total$269.10");
  await form.getByLabel("Full name").fill("Ana Rivera");
  await form.getByLabel("Email (their link goes here)").fill("ana@example.com");
  await form.getByLabel("Phone").fill("3055550133");
  await form.getByLabel("Street address").fill("1500 Bay Rd");
  await form.getByLabel("City").fill("Miami Beach");
  await form.getByLabel("What they asked for (optional)").fill("Cream set please");
  await form.getByLabel("Discount code (optional)").fill("CHRISTMAS15");
  await expect(price).toContainText("Code CHRISTMAS15");
  await expect(price).toContainText("Total$254.15");
  await expect(price).toContainText("Code CHRISTMAS15 saves more than today's special offer, so the code is used.");

  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);

  await form.getByRole("button", { name: "Book it and send the link" }).click();
  await expect(form.getByRole("heading", { name: "✓ Booked TH-20261112-4459" })).toBeVisible();
  expect(sent).toMatchObject({
    bundleId: "our-little-story",
    locale: "en",
    slot: { start: "13:00" },
    discountCode: "CHRISTMAS15",
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
