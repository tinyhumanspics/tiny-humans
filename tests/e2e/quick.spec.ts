import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { QuickRequest } from "@/lib/quick/types";
import { signedInAdmin } from "./fixtures/admin";

/**
 * The quick form (/quick, owner Nov 13): a family sends a few details and the owners book it for them from /admin →
 * Quotes / Booking. The send is faked in the browser test (CI has no database or email); the API's own checks run for real.
 */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("a family sends the quick form: required fields first, the optional ones, then the thank-you", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/quick", (route) => {
    sent = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({ status: 201, json: { ok: true } });
  });
  await page.goto("/quick");
  await expect(page.getByRole("heading", { level: 1, name: "Let us book it for you" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", "play");
  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);

  // nothing filled in: the first missing field says so and gets the focus
  await page.getByRole("button", { name: "Send my details" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Please add your full name.");
  await expect(page.getByLabel("Full name")).toBeFocused();
  await page.getByLabel("Full name").fill("Ana Rivera");
  await page.getByLabel("Phone (we'll text you)").fill("305 555");
  await page.getByRole("button", { name: "Send my details" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Please add a phone number with at least 10 digits.");
  await page.getByLabel("Phone (we'll text you)").fill("(305) 555-0133");
  await page.getByLabel("Email").fill("ana@example.com");
  await page.getByLabel("Your ZIP code").fill("33139");

  await page.getByLabel("Baby's name (optional)").fill("Mia");
  await expect(page.getByLabel("Due date (optional)")).toHaveCount(0);
  await page.getByLabel("Baby's age").selectOption("Not born yet");
  await page.getByLabel("Due date (optional)").fill("2026-12-20");
  const bundles = page.getByRole("group", { name: "Bundle you like (optional)" });
  await expect(bundles.getByRole("button", { name: "Not sure yet" })).toHaveAttribute("aria-pressed", "true");
  await bundles.getByRole("button", { name: /Our Little Story/ }).click();
  await expect(bundles.getByRole("button", { name: /Our Little Story/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Best days or times (optional)").fill("weekday mornings");
  await page.getByLabel("Anything else? (optional)").fill("Cream set please");
  await page.getByRole("button", { name: "Send my details" }).click();

  await expect(page.getByRole("heading", { name: "Got it, Ana!" })).toBeFocused();
  await expect(page.getByText("We'll text you shortly to pick your date and time.", { exact: false })).toBeVisible();
  expect(sent).toMatchObject({
    parentName: "Ana Rivera",
    phone: "(305) 555-0133",
    email: "ana@example.com",
    zip: "33139",
    babyName: "Mia",
    babyAge: "Not born yet",
    dueDate: "2026-12-20",
    bundleId: "our-little-story",
    bestTime: "weekday mornings",
    message: "Cream set please",
    locale: "en",
    hp: "",
  });
  expect(sent!.elapsedMs).toEqual(expect.any(Number));
});

test("the quick form's API checks the details and refuses forms sent too fast", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the API");
  const ok = { parentName: "Ana Rivera", phone: "3055550133", email: "ana@example.com", zip: "33139", locale: "en", hp: "", elapsedMs: 9000 };
  const badZip = await request.post("/api/quick", { data: { ...ok, zip: "331" } });
  expect(badZip.status()).toBe(400);
  expect(await badZip.json()).toMatchObject({ field: "zip", error: "Please add your 5-digit ZIP code." });
  const spanish = await request.post("/api/quick", { data: { ...ok, email: "ana@", locale: "es" } });
  expect(await spanish.json()).toMatchObject({ field: "email", error: "Agrega un correo electrónico válido." });
  const tooFast = await request.post("/api/quick", { data: { ...ok, elapsedMs: 900 } });
  expect(tooFast.status()).toBe(400);
  const bot = await request.post("/api/quick", { data: { ...ok, hp: "https://spam.example" } });
  expect(bot.status()).toBe(400);
  // CI has no database and no email key: nothing could be kept, so the family is told to try again or text
  const unsaved = await request.post("/api/quick", { data: ok });
  expect(unsaved.status()).toBe(503);
  expect((await unsaved.json()).error).toContain("We couldn't send your details just now.");
});

test("Quotes / Booking: the quick form's link, a family's request, and Book it for them fills the form", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await signedInAdmin(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const request: QuickRequest = {
    id: "0f8b6a4e-6c1d-4b7a-9a51-3f2f6a0b1c2d",
    parentName: "Ana Rivera",
    email: "ana@example.com",
    phone: "3055550133",
    zip: "33139",
    babyName: "Mia",
    babyAge: "2–6 weeks",
    dueDate: null,
    bundleId: "our-little-story",
    bundleName: "Our Little Story",
    bestTime: "weekday mornings",
    message: "Cream set please",
    locale: "es",
    status: "new",
    bookingReference: null,
    createdAt: new Date().toISOString(),
  };
  let list = [request];
  const patches: unknown[] = [];
  await page.route("**/api/admin/quick", (route) => route.fulfill({ json: { requests: list } }));
  await page.route("**/api/admin/quick/*", (route) => {
    if (route.request().method() === "DELETE") {
      list = [];
      return route.fulfill({ status: 204 });
    }
    const body = route.request().postDataJSON() as { status: QuickRequest["status"]; bookingReference?: string };
    patches.push(body);
    list = [{ ...request, status: body.status, bookingReference: body.bookingReference ?? null }];
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/admin/booking/slots?*", (route) => {
    const q = new URL(route.request().url()).searchParams;
    const days = [];
    for (let d = new Date(`${q.get("from")}T12:00:00Z`); d <= new Date(`${q.get("to")}T12:00:00Z`); d = new Date(d.getTime() + 864e5)) {
      const date = d.toISOString().slice(0, 10);
      days.push({ date, slots: [{ id: `${date}T13:00`, date, start: "13:00", end: "15:00", label: "1:00 PM" }] });
    }
    return route.fulfill({ json: { days } });
  });
  await page.route("**/api/admin/booking/price?*", (route) =>
    route.fulfill({ json: { quote: { bundleId: "our-little-story", bundleName: "Our Little Story", regularCents: 29900, offerCents: null, offerLabel: null, offerEndsOn: null, discountCode: null, discountCents: 0, finalCents: 29900, totalCents: 29900, pricingType: "regular", addons: [], addonsCents: 0, note: null }, travel: { status: "free", miles: 4, feeCents: 0 }, totalCents: 29900, depositCents: 5000 } }),
  );
  let booked: Record<string, unknown> | null = null;
  await page.route("**/api/admin/booking", (route) => {
    booked = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({ status: 201, json: { reference: "TH-20261113-5120", status: "pending", url: "http://localhost:3100/book?x", holdUntil: new Date(Date.now() + 48 * 3_600_000).toISOString(), sms: "Hi Ana!", emailed: true, pricing: { totalCents: 29900 }, travel: { feeCents: null, miles: null } } });
  });

  await page.goto("/admin/quotes");
  const quick = page.getByRole("region", { name: /Quick form/ });
  await expect(quick.getByRole("heading", { name: "Quick form · 1 new" })).toBeVisible();
  await quick.getByRole("button", { name: "Copy the link" }).click();
  await expect(quick.getByRole("button", { name: "Link copied ✓" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/quick$/);
  const card = quick.getByRole("listitem").filter({ hasText: "Ana Rivera" });
  await expect(card).toContainText("Our Little Story · ZIP 33139 · Baby: Mia · 2–6 weeks");
  await expect(card).toContainText("Spanish");
  await expect(card.getByRole("link", { name: "Text Ana Rivera" })).toHaveAttribute("href", /^sms:/);
  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).include("#quick-requests-title").withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);

  await card.getByRole("button", { name: "Book it for them" }).click();
  const form = page.getByRole("region", { name: "Book it for them" });
  await expect(form.getByText("From the quick form: Ana Rivera.", { exact: false })).toBeVisible();
  await expect(form.getByLabel("Bundle")).toHaveValue("our-little-story");
  await expect(form.getByLabel("Full name")).toHaveValue("Ana Rivera");
  await expect(form.getByLabel("Email (their link goes here)")).toHaveValue("ana@example.com");
  await expect(form.getByLabel("Phone")).toHaveValue("3055550133");
  await expect(form.getByLabel(/Their ZIP code/)).toHaveValue("33139");
  await expect(form.getByLabel("Baby's name (optional)")).toHaveValue("Mia");
  await expect(form.getByLabel("Baby's age")).toHaveValue("2–6 weeks");
  await expect(form.getByLabel("What they asked for (optional)")).toHaveValue("Best times: weekday mornings\nCream set please");

  // their address (the quick form doesn't ask for it), the day and the time, then book it: the request shows the booking
  await form.getByLabel("Street address").fill("1500 Bay Rd");
  await form.getByLabel("City").fill("Miami Beach");
  const calendar = form.getByRole("grid");
  await expect(calendar).toHaveAttribute("aria-busy", "false");
  await calendar.locator('button[aria-label*="available"]:not([disabled])').first().click();
  await form.getByRole("button", { name: "1:00 PM" }).click();
  await form.getByRole("button", { name: "Book it and send the link" }).click();
  await expect(form.getByRole("heading", { name: "✓ Booked TH-20261113-5120" })).toBeVisible();
  expect(booked).toMatchObject({ bundleId: "our-little-story", locale: "es", contact: { parentName: "Ana Rivera", babyName: "Mia", babyAge: "2–6 weeks" }, address: { zip: "33139" } });
  await expect.poll(() => patches).toEqual([{ status: "booked", bookingReference: "TH-20261113-5120" }]);
  await expect(quick.getByRole("heading", { name: "Quick form" })).toBeVisible();
  await quick.getByRole("button", { name: "Show booked and done (1)" }).click();
  await expect(quick.getByRole("listitem").filter({ hasText: "Ana Rivera" })).toContainText("Booked TH-20261113-5120");

  // delete asks first
  await quick.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete Ana Rivera's request?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(quick.getByText("No requests yet.")).toBeVisible();
});
