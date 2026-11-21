import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import type { BookingLinkSummary } from "@/lib/booking-links/types";
import type { RequestListItem } from "@/lib/requests/types";
import { signedInAdmin } from "./fixtures/admin";
import { hydrated } from "./fixtures/hydration";

/**
 * /admin → Quotes / Booking → "Send a booking link" (owner, Nov 19): the owner fills in only the session a family agreed
 * (bundle, baby, ZIP, day, optional time) and sends the link; the family's /book opens filled in and they add their
 * own details; the request shows "From your link" in Requests. APIs faked (the real flow is checked against
 * scripts/local-db).
 */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const TOKEN = "a".repeat(43);
const URL_ = `http://localhost:3100/book?link=${TOKEN}`;

/** Every day open at 9:00 and 1:00 PM except Sundays. */
const openDays = (route: Route) => {
  const q = new URL(route.request().url()).searchParams;
  const days = [];
  for (let d = new Date(`${q.get("from")}T12:00:00Z`); d <= new Date(`${q.get("to")}T12:00:00Z`); d = new Date(d.getTime() + 864e5)) {
    const date = d.toISOString().slice(0, 10);
    days.push({ date, slots: d.getUTCDay() === 0 ? [] : [{ id: `${date}T09:00`, date, start: "09:00", end: "11:00", label: "9:00 AM" }, { id: `${date}T13:00`, date, start: "13:00", end: "15:00", label: "1:00 PM" }] });
  }
  return route.fulfill({ json: { days } });
};

/** A weekday about two weeks out (Miami time), so it's open and in the booking window. */
function linkDay(): string {
  for (let n = 14; ; n++) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() + n * 864e5));
    if (new Date(`${key}T12:00:00Z`).getUTCDay() !== 0) return key;
  }
}

test("Quotes / Booking → Send a booking link: only the session; the link and a text to copy", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await signedInAdmin(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const asked: string[] = [];
  await page.route("**/api/booking/availability?*", (route) => {
    asked.push(new URL(route.request().url()).searchParams.toString());
    return openDays(route);
  });
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/admin/booking-links", (route) => {
    sent = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({ status: 201, json: { url: URL_, text: `Hi! This is Tiny Humans. Here's your link to book your session: ${URL_}` } });
  });

  await page.goto("/admin/quotes");
  const form = page.getByRole("region", { name: "Send a booking link" });
  // nothing about the family's name, email, phone or address: they type those themselves
  await expect(form.getByLabel("Full name")).toHaveCount(0);
  await expect(form.getByLabel(/Email/)).toHaveCount(0);
  const bundle = form.getByLabel("Bundle");
  await expect(bundle.locator("option")).toHaveText([/^Little Moments · \$\d/, /^Our Little Story · \$\d/, /^Our Family Story · \$\d/]);
  await bundle.selectOption({ index: 1 });
  await form.getByLabel("Baby's name (optional)").fill("Mia");
  // boy or girl is asked every time (owner, Nov 19)
  await expect(form.getByLabel("Boy or girl").locator("option")).toHaveText(["Choose…", "Boy", "Girl", "Not sure yet"]);
  await expect(form.getByText("Add their ZIP code to see the calendar", { exact: false })).toBeVisible();
  await form.getByLabel("Their ZIP code").fill("33139");
  const calendar = form.getByRole("grid");
  await expect(calendar).toHaveAttribute("aria-busy", "false");
  expect(asked.at(-1)).toContain("bundle=our-little-story");
  expect(asked.at(-1)).toContain("zip=33139");
  await calendar.locator('button[aria-label*="available"]:not([disabled])').first().click();
  // the time is optional: tap one, tap it again to leave it to them, tap it once more
  const one = form.getByRole("button", { name: "1:00 PM" });
  await one.click();
  await expect(one).toHaveAttribute("aria-pressed", "true");
  await one.click();
  await expect(one).toHaveAttribute("aria-pressed", "false");
  await one.click();

  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);

  await form.getByRole("button", { name: "Make their link" }).click();
  await expect(form.getByRole("alert")).toHaveText("Pick boy or girl (or Not sure yet).");
  await form.getByLabel("Boy or girl").selectOption({ label: "Girl" });
  await form.getByRole("button", { name: "Make their link" }).click();
  await expect(form.getByRole("alert")).toHaveText("Pick how they reached you.");
  await form.getByLabel("How did they reach you?").selectOption({ label: "Instagram DM" });
  await form.getByRole("button", { name: "Make their link" }).click();
  await expect(form.getByRole("heading", { name: "✓ Their link is ready" })).toBeVisible();
  expect(sent).toMatchObject({ bundleId: "our-little-story", babies: [{ age: "Newborn (0–2 weeks)", name: "Mia", gender: "girl" }], zip: "33139", start: "13:00", locale: "en", source: "instagram_dm" });
  await expect(form).toContainText("Mia, Girl, Newborn (0–2 weeks)");
  expect(String(sent!.date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await expect(form.getByLabel("Their link")).toHaveValue(URL_);
  await form.getByRole("button", { name: "Copy their link" }).click();
  await expect(form.getByRole("button", { name: "Link copied ✓" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(URL_);
  await form.getByRole("button", { name: "Copy a text message" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(URL_);
  await form.getByRole("button", { name: "Make another link" }).click();
  await expect(form.getByLabel("Their ZIP code")).toHaveValue("");
});

async function openLink(page: Page, link: BookingLinkSummary | null) {
  await page.route("**/api/booking/link?*", (route) => (link ? route.fulfill({ json: { link } }) : route.fulfill({ status: 404, json: { error: "not_found", code: "not_found" } })));
  await page.route("**/api/booking/availability?*", openDays);
  await page.goto(`/book?link=${TOKEN}`);
}

test("the family's link: their bundle, baby, day and time are filled in; they add their details; the link goes with the request", async ({ page }) => {
  const date = linkDay();
  let body: Record<string, unknown> | null = null;
  await page.route("**/api/booking/request", (route) => {
    body = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({ status: 201, json: { request: { reference: "TH-R-1", firstName: "Ana", mobile: "(305) 555-0133", type: "date", slot: { date, start: "13:00" } }, lead: false } });
  });
  await openLink(page, { bundleId: "our-little-story", babies: [{ age: "Newborn (0–2 weeks)", name: "Mia", gender: "girl" }], zip: "33139", date, start: "13:00", locale: "en" });
  await expect(page.getByText("Your session details")).toBeVisible();
  await expect(page.getByText("For Mia · Girl · Newborn (0–2 weeks)")).toBeVisible();
  // their bundle with Change, no "Not born yet", no twins box
  await expect(page.getByRole("button", { name: "Not born yet" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change" })).toBeVisible();
  await expect(page.getByText(/^Our Little Story · \$/)).toBeVisible();
  // the day and the time are already picked
  const checked = page.locator('input[id^="time-"]:checked');
  await expect(checked).toHaveCount(1);
  await expect(page.locator(`label[for="${await checked.getAttribute("id")}"]`)).toContainText("1:00");
  await page.getByRole("button", { name: "Next: your details" }).click();
  await hydrated(page, "#request-firstName");
  await expect(page.locator("#request-zip")).toHaveValue("33139");
  await page.locator("#request-firstName").fill("Ana");
  await page.locator("#request-mobile").fill("3055550133");
  await page.locator("#request-email").fill("ana@example.com");
  await page.getByRole("button", { name: "Request this time" }).click();
  await expect(page.getByRole("heading", { name: /Ana/ })).toBeVisible();
  expect(body).toMatchObject({ linkToken: TOKEN, bundleId: "our-little-story", babyCount: 1, slot: { date, start: "13:00" }, zip: "33139", firstName: "Ana", email: "ana@example.com" });
});

test("a used or past booking link says so, with the number to text", async ({ page }) => {
  await openLink(page, null);
  await expect(page.locator("main").getByRole("alert")).toContainText("This booking link was already used, or its day has passed.");
});

test("Requests: a request from your link says so, with the baby and how they reached you", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await signedInAdmin(page);
  const item: RequestListItem = {
    id: "00000000-0000-4000-8000-000000000009",
    reference: "TH-R-20261119-4242",
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    locale: "en",
    type: "date",
    status: "new",
    bundleId: "our-little-story",
    bundleName: "Our Little Story",
    babyCount: 1,
    totalCents: 26910,
    travelStatus: "free",
    travelMiles: 4,
    travelFeeCents: 0,
    slotDate: linkDay(),
    slotStart: "13:00",
    dueDate: null,
    holdUntil: new Date(Date.now() + 11 * 3_600_000).toISOString(),
    firstName: "Ana",
    mobile: "(305) 555-0133",
    email: "ana@example.com",
    zip: "33139",
    textConsent: true,
    made: null,
    hello: "Hi Ana!",
    link: { source: "Instagram DM", babies: [{ age: "Newborn (0–2 weeks)", name: "Mia", gender: "girl" }] },
  };
  await page.route("**/api/admin/requests", (route) => route.fulfill({ json: { requests: [item] } }));
  await page.goto("/admin/requests");
  const card = page.locator(`#request-${item.reference}`);
  await expect(card.getByText("From your link")).toBeVisible();
  await expect(card).toContainText("Mia, Girl, Newborn (0–2 weeks) · came by Instagram DM");
});
