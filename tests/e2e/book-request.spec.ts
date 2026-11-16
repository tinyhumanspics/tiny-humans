import { expect, test, type Page } from "@playwright/test";
import { BUILT_IN } from "@/config/media";
import { hydrated } from "./fixtures/hydration";

/**
 * /book (brief 02): 1) When 2) Your details (4 boxes, "Send request")
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
  await page.goto("/book?bundle=our-little-story&utm_source=facebook");
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
  await page.goto("/book?bundle=little-moments");
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
  await page.goto("/book");
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
  await page.goto("/book?bundle=forever-little");
  const time = await pickTime(page, 2);
  const day = await page.locator('[role="grid"] button[aria-pressed="true"], [role="grid"] [aria-selected="true"]').first().getAttribute("aria-label");
  await details(page, { firstName: "Ana", mobile: "3055550101", email: "ana.first@example.com", zip: "33139" });

  // family B sends a request for the same time first
  const other = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "198.51.100.77" }, userAgent: INSTAGRAM_UA });
  const b = await other.newPage();
  await b.route("**/api/booking/funnel", (r) => r.fulfill({ status: 204 }));
  await b.goto("/book?bundle=forever-little");
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
  await c.goto("/book?bundle=forever-little");
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
  await page.goto("/book?bundle=little-moments");
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

test("no chalk intro on /book", async ({ page }) => {
  await page.goto("/book?bundle=little-moments");
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", /.+/);
});

test("a gallery picture picked as inspiration shows on /book and goes with the request (owner, Nov 11)", async ({ page }) => {
  // the second picture of the one "Little moments" gallery
  const picture = BUILT_IN.sections.flatMap((x) => x.photos)[1];
  const posted: Record<string, unknown>[] = [];
  page.on("request", (r) => r.url().includes("/api/booking/request") && posted.push(r.postDataJSON()));
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(`^Open photo 2 of \\d+: `) }).click();
  const viewer = page.getByRole("dialog", { name: "Photo viewer" });
  await viewer.getByRole("link", { name: "Use this one as my inspiration" }).click();
  await expect(page).toHaveURL(new RegExp(`/bundles\\?inspiration=${picture.id}$`));
  await page.getByRole("link", { name: /Choose Little Moments/i }).click();
  await expect(page).toHaveURL(new RegExp(`/book\\?bundle=little-moments&inspiration=${picture.id}$`));
  await expect(page.getByText(`You picked “${picture.title}”`)).toBeVisible();
  await pickTime(page, 5);
  await details(page, { firstName: "Rosa", mobile: "305-555-0133", email: "rosa.request@example.com", zip: "33139" });
  await send(page);
  await expect(page.getByRole("heading", { name: "Request sent, Rosa." })).toBeFocused();
  expect(posted.at(-1)).toMatchObject({ bundleId: "little-moments", inspiration: picture.id });
});

test("a due-date reservation's link: its bundle and kept price, details filled in, a day and time only (APIs faked)", async ({ page }) => {
  const token = "due-token-0123456789abcdefghijklmnopqrstuv";
  await page.route("**/api/booking/due?*", (r) =>
    r.fulfill({
      json: {
        due: { reference: "TH-D-20261101-0001", bundleId: "our-little-story", bundleName: "Our Little Story", dueDate: "2026-12-20", babyCount: 1, bundlePriceCents: 24900, regularPriceCents: 29900, offerLabel: "Thanksgiving Offer", depositPaidCents: 5000, backdrops: [], discountCode: null, contact: { parentName: "Lucía Gómez", email: "lucia@example.com", phone: "(786) 555-0199", street: "", unit: "", city: "", zip: "33139" } },
      },
    }),
  );
  // every day open at 9:00 (no real hold is made: the request below is faked too)
  await page.route("**/api/booking/availability?*", (r) => {
    const q = new URL(r.request().url()).searchParams;
    const days = [];
    for (let d = new Date(`${q.get("from")}T12:00:00Z`); d <= new Date(`${q.get("to")}T12:00:00Z`); d = new Date(d.getTime() + 864e5)) {
      const date = d.toISOString().slice(0, 10);
      days.push({ date, slots: [{ id: `${date}T09:00`, date, start: "09:00", end: "11:00", label: "9:00 AM" }] });
    }
    return r.fulfill({ json: { days } });
  });
  let body: Record<string, unknown> | null = null;
  await page.route("**/api/booking/request", (r) => {
    body = r.request().postDataJSON() as Record<string, unknown>;
    return r.fulfill({ status: 201, json: { request: { reference: "TH-R-1", firstName: "Lucía", mobile: "(786) 555-0199", type: "date", slot: body.slot } } });
  });
  await page.goto(`/book?bundle=our-little-story&due=${token}`);
  await expect(page.getByText("Your due-date reservation")).toBeVisible();
  await expect(page.getByText("Pick a day and time for Our Little Story. Your price ($249) is kept.")).toBeVisible();
  await expect(page.getByText("Your $50 deposit is already paid, so there's nothing to pay now.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Not born yet" })).toHaveCount(0);
  await pickTime(page, 0);
  await page.getByRole("button", { name: "Next: your details" }).click();
  await hydrated(page, "#request-firstName");
  await expect(page.locator("#request-firstName")).toHaveValue("Lucía");
  await expect(page.locator("#request-email")).toHaveValue("lucia@example.com");
  await expect(page.getByText("Nothing to pay now", { exact: false })).toBeVisible();
  await send(page);
  await expect(page.getByRole("heading", { name: "Request sent, Lucía." })).toBeFocused();
  expect(body).toMatchObject({ type: "date", bundleId: "our-little-story", dueToken: token, firstName: "Lucía", mobile: "(786) 555-0199", zip: "33139" });
});

/** Meta's Pixel is off in tests: a stand-in `fbq` records what our code would send. sms:/tel: taps stay on the page. */
async function recordPixel(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { fbq: (...a: unknown[]) => void; __fbq: unknown[][] };
    w.__fbq = [];
    w.fbq = (...a: unknown[]) => void w.__fbq.push(a);
    window.addEventListener("click", (e) => (e.target as Element | null)?.closest?.('a[href^="sms:"], a[href^="tel:"]') && e.preventDefault());
  });
  return () => page.evaluate(() => (window as unknown as { __fbq: unknown[][] }).__fbq);
}

test("brief 03: one Lead per person (browser, same id as the server), Contact on a text tap", async ({ page }) => {
  const calls = await recordPixel(page);
  const who = { firstName: "Lea", mobile: `(305) 555-${String(1000 + Math.floor(Math.random() * 8999))}`, email: `lead.${test.info().project.name}.${Date.now()}@example.com`, zip: "33139" };
  await page.goto("/book?bundle=little-moments&utm_source=meta&th_ad=1&th_adset=2&th_campaign=3");
  await hydrated(page, "#request-title");
  await page.getByRole("button", { name: "Not born yet" }).click();
  await page.fill("#request-due", new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10));
  await details(page, who);
  const answer = page.waitForResponse((r) => r.url().endsWith("/api/booking/request"));
  await send(page);
  const body = (await (await answer).json()) as { request: { reference: string }; lead: boolean };
  await expect(page.getByRole("heading", { name: "Request sent, Lea." })).toBeVisible();
  expect(body.lead).toBe(true);
  expect((await calls()).filter((c) => c[1] === "Lead")).toEqual([["track", "Lead", { content_name: "request", content_ids: ["little-moments"] }, { eventID: body.request.reference }]]);
  // Contact: the tap-to-text number on the Request sent screen
  await page.getByRole("link", { name: "(786) 222-7194" }).click();
  expect((await calls()).filter((c) => c[1] === "Contact")).toEqual([["track", "Contact", { content_name: "text" }]]);
  // the same person again (same email) within 30 days: the request is saved, no Lead
  const again = await page.request.post("/api/booking/request", { data: { clientId: `again-${Date.now()}`, locale: "en", type: "due_date", bundleId: "little-moments", babyCount: 1, dueDate: new Date(Date.now() + 41 * 864e5).toISOString().slice(0, 10), firstName: "Lea", mobile: "(786) 555-0101", email: who.email, zip: "33139", textConsent: false, elapsedMs: 9000 } });
  expect(again.status()).toBe(201);
  expect(((await again.json()) as { lead: boolean }).lead).toBe(false);
});

test("brief 03: no Pixel calls on a page whose link carries a secret token", async ({ page }) => {
  const calls = await recordPixel(page);
  const booking = { reference: "TH-20261201-0001", bundleId: "little-moments", bundleName: "Little Moments", date: "2026-12-01", start: "09:00", end: "10:00", parentFirstName: "Ana", status: "active", canCancel: false, noticeHours: 48 };
  await page.route("**/api/booking/cancel*", (r) => r.fulfill({ json: { booking } }));
  await page.goto("/cancel?t=secret-token-0123456789abcdef");
  await page.getByRole("link", { name: /Text us at/ }).click();
  expect(await calls()).toEqual([]);
});

test("brief 04: 'Not born yet?' buttons open /book on the due date", async ({ page }) => {
  await page.goto("/");
  const cta = page.locator('main a[href="/book?when=due"]').first();
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page).toHaveURL(/\/book\?when=due$/);
  await expect(page.getByRole("button", { name: "Not born yet" })).toHaveAttribute("aria-pressed", "true");
  // no bundle in the link: they choose one, then the due date
  await hydrated(page, "#request-title");
  await page.getByRole("button", { name: /^Little Moments/ }).click();
  await expect(page.locator("#request-due")).toBeVisible();
});
