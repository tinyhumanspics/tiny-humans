import { expect, test, type Page } from "@playwright/test";
import { hydrated } from "./fixtures/hydration";

/**
 * The new /book (brief 02, at /book/new until it replaces /book): 1) When 2) Your details (4 boxes, "Send request")
 * 3) Request sent. Nothing is paid. Mock provider: requests live in the test server's memory; a requested time is
 * held from other visitors for 12 hours.
 */

const INSTAGRAM_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 389.0.0.29.87 (iPhone15,2; iOS 18_5; en_US; en; scale=3.00; 1179x2556; 739461213)";

const openDays = (page: Page) => page.locator('button[aria-label*="time available"], button[aria-label*="times available"]');

test.beforeEach(async ({ page }) => {
  // never count steps from a test; a payment or the old booking API must never be reached
  await page.route("**/api/booking/funnel", (r) => r.fulfill({ status: 204 }));
  await page.route(/\/api\/booking\/(create|deposit)|stripe\.com/, (r) => r.abort());
});

/**
 * Each test and browser takes its own day next month: the three browsers run at once against one test server, and a
 * time one of them requests is held from the others (that's the feature).
 */
const PROJECT_SLOT: Record<string, number> = { "iphone-safari": 0, "android-chrome": 1, "desktop-chrome": 2 };
const dayFor = (k: number) => (PROJECT_SLOT[test.info().project.name] ?? 0) * 6 + k;

/** Screen 1: next month, its open day number `k` (per test and browser), and that day's first time. */
async function pickTime(page: Page, k: number) {
  await expect(page.getByRole("heading", { name: "When should we come?" })).toBeVisible();
  await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-busy", "false");
  const open = await openDays(page).count();
  await openDays(page).nth(dayFor(k) % open).click();
  const time = page.locator('label[for^="time-"]').first();
  await expect(time).toBeVisible();
  const label = (await time.innerText()).split("\n")[0].trim();
  await time.click();
  return label;
}

/** Screen 2: the four boxes (after React has hydrated them). */
async function details(page: Page, who = { firstName: "Dana", mobile: "305-555-0122", email: "dana.request@example.com", zip: "33139" }) {
  await page.getByRole("button", { name: "Next: your details" }).click();
  await expect(page.getByRole("heading", { name: "Where should we text you?" })).toBeFocused();
  await hydrated(page, "#request-firstName");
  for (const [k, v] of Object.entries(who)) await page.fill(`#request-${k}`, v);
}

async function send(page: Page) {
  // the server refuses requests sent faster than a person (3 s)
  await page.waitForTimeout(3200);
  await page.getByRole("button", { name: "Send request" }).click();
}

test("a family sends a request in 3 screens and 4 boxes, with nothing to pay", async ({ page }) => {
  const posted: Record<string, unknown>[] = [];
  page.on("request", (r) => r.url().includes("/api/booking/request") && posted.push(r.postDataJSON()));
  await page.goto("/book/new?bundle=our-little-story&utm_source=facebook");
  await expect(page.getByText("Our Little Story", { exact: false }).first()).toBeVisible();
  const time = await pickTime(page, 0);
  await details(page);
  // exactly four typed boxes on this screen, and the text box isn't ticked for them
  await expect(page.locator('input[id^="request-"]:not(#request-hp):not([type="checkbox"])')).toHaveCount(4);
  await expect(page.getByRole("checkbox", { name: /Text me about this request/ })).not.toBeChecked();
  await expect(page.getByText(new RegExp(`${time.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} · Our Little Story · \\$`))).toBeVisible();
  await send(page);
  await expect(page.getByRole("heading", { name: "Request sent, Dana." })).toBeFocused();
  await expect(page.getByText("We'll text you at (305) 555-0122 within minutes (8 a.m.–8 p.m.) to confirm", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "(786) 222-7194" })).toHaveAttribute("href", "sms:+17862227194");
  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({ type: "date", bundleId: "our-little-story", babyCount: 1, firstName: "Dana", mobile: "305-555-0122", zip: "33139", textConsent: false });
});

test("Not born yet: a due date instead of a time, and the day 5–14 rule", async ({ page }) => {
  await page.goto("/book/new?bundle=little-moments");
  await expect(page.getByRole("heading", { name: "When should we come?" })).toBeVisible();
  await hydrated(page, "#request-title");
  await page.getByRole("button", { name: "Not born yet" }).click();
  await expect(page.getByText("When baby arrives, text us and we move it to day 5–14.")).toBeVisible();
  // a date too far ahead stops screen 1
  const max = await page.locator("#request-due").getAttribute("max");
  await page.getByRole("button", { name: "Next: your details" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Pick your due date.");
  const due = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
  expect(due <= max!).toBe(true);
  await page.fill("#request-due", due);
  await details(page, { firstName: "Maya", mobile: "(786) 555-0199", email: "maya.due@example.com", zip: "33301" });
  await expect(page.getByText(/Due date: .* · Little Moments · \$/)).toBeVisible();
  await send(page);
  await expect(page.getByRole("heading", { name: "Request sent, Maya." })).toBeVisible();
  await expect(page.getByText("to confirm your due date (", { exact: false })).toBeVisible();
});

test("without ?bundle= the family picks a bundle on screen 1; twins add the extra-baby price", async ({ page }) => {
  await page.goto("/book/new");
  await expect(page.getByText("Choose your bundle")).toBeVisible();
  await page.getByRole("button", { name: "Next: your details" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Choose a bundle first.");
  await page.getByRole("button", { name: /Little Moments/ }).click();
  await expect(page.getByRole("button", { name: "change" })).toBeVisible();
  await page.getByText("Twins? +$75 per extra baby").click();
  await pickTime(page, 1);
  await details(page);
  await expect(page.getByText(/· Little Moments · \$/)).toBeVisible();
  // "change" brings the list back, with the bundle picked
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "change" }).click();
  await expect(page.getByRole("button", { name: /Little Moments/ })).toHaveAttribute("aria-pressed", "true");
});

test("a requested time is held from other families; one taken meanwhile sends them back to the times, details kept", async ({ page, browser }) => {
  // family A picks a time and reaches their details
  await page.goto("/book/new?bundle=forever-little");
  const time = await pickTime(page, 2);
  const day = await page.locator('[role="grid"] button[aria-pressed="true"], [role="grid"] [aria-selected="true"]').first().getAttribute("aria-label");
  await details(page, { firstName: "Ana", mobile: "3055550101", email: "ana.first@example.com", zip: "33139" });

  // family B sends a request for the same time first
  const other = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "198.51.100.77" }, userAgent: INSTAGRAM_UA });
  const b = await other.newPage();
  await b.route("**/api/booking/funnel", (r) => r.fulfill({ status: 204 }));
  await b.goto("/book/new?bundle=forever-little");
  await expect(b.locator('[role="grid"]')).toHaveAttribute("aria-busy", "false");
  await b.getByRole("button", { name: "Next month" }).click();
  await b.locator(`[role="grid"] button[aria-label="${day}"]`).click();
  await b.locator('label[for^="time-"]', { hasText: time }).first().click();
  await details(b, { firstName: "Bea", mobile: "3055550102", email: "bea.second@example.com", zip: "33139" });
  await send(b);
  await expect(b.getByRole("heading", { name: "Request sent, Bea." })).toBeVisible();

  // a third visitor no longer sees that time
  const third = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "198.51.100.78" } });
  const c = await third.newPage();
  await c.route("**/api/booking/funnel", (r) => r.fulfill({ status: 204 }));
  await c.goto("/book/new?bundle=forever-little");
  await expect(c.locator('[role="grid"]')).toHaveAttribute("aria-busy", "false");
  await c.getByRole("button", { name: "Next month" }).click();
  await expect(c.locator('[role="grid"]')).toHaveAttribute("aria-busy", "false");
  // the same day: one time fewer (or no times left), and never the requested one
  const cell = c.locator(`[role="grid"] button[aria-label^="${day!.split(",").slice(0, 3).join(",")},"]`);
  await expect(cell).not.toHaveAttribute("aria-label", day!);
  if (await cell.isEnabled()) {
    await cell.click();
    await expect(c.locator('label[for^="time-"]').first()).toBeVisible();
    await expect(c.locator('label[for^="time-"]', { hasText: new RegExp(`^${time.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })).toHaveCount(0);
  }
  await other.close();
  await third.close();

  // family A sends: that time is gone, so back to screen 1 with the reason; their details are still there
  await send(page);
  await expect(page.getByRole("heading", { name: "When should we come?" })).toBeFocused();
  await expect(page.locator("main").getByRole("alert")).toHaveText("That time was just taken. Please pick another one.");
  await pickTime(page, 3);
  await page.getByRole("button", { name: "Next: your details" }).click();
  await expect(page.locator("#request-firstName")).toHaveValue("Ana");
  await expect(page.locator("#request-mobile")).toHaveValue("3055550101");
});

test("wrong boxes are explained in words; a ZIP outside Florida stops the request", async ({ page }) => {
  await page.goto("/book/new?bundle=little-moments");
  await pickTime(page, 4);
  await details(page, { firstName: " ", mobile: "12345", email: "not-an-email", zip: "331" });
  await send(page);
  await expect(page.getByText("Add your first name.")).toBeVisible();
  await expect(page.getByText("Enter a US mobile number (10 digits).")).toBeVisible();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Enter a 5-digit ZIP code.")).toBeVisible();
  await expect(page.locator("#request-firstName")).toBeFocused();
  for (const [k, v] of Object.entries({ firstName: "Lee", mobile: "3055550111", email: "lee@example.com", zip: "10001" })) await page.fill(`#request-${k}`, v);
  await expect(page.getByText("We only come to homes in Florida.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("We only come to homes in Florida.");
  await expect(page.getByRole("heading", { name: "Where should we text you?" })).toBeVisible();
});

test("no chalk intro on the new /book", async ({ page }) => {
  await page.goto("/book/new?bundle=little-moments");
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", /.+/);
});
