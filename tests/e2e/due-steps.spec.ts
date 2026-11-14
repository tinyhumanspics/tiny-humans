import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * "Not born yet?" in four steps (owner, Nov 11; step one split Nov 13): bundle, due date, first name, email, ZIP code →
 * last name, phone, home ("Reserve my spot" is checked by the real server, no database needed) → backdrops (or "Not
 * sure yet") → review with a discount code → the deposit. The final reservation and the code check are faked.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.beforeEach(async ({ page }) => {
  // never count steps or save drafts from a test
  await page.route("**/api/booking/draft", (r) => r.fulfill({ status: 204 }));
});

/** Step 1: due date, first name, email, ZIP code. */
async function stepOne(page: Page, zip = "33139") {
  await page.goto("/due-date?bundle=our-little-story");
  await page.fill("#due-date", new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10));
  for (const [k, v] of Object.entries({ firstName: "Dana", email: "dana.due@example.com", zip })) await page.fill(`#due-${k}`, v);
}
/** Step 2: last name, phone, home. */
async function stepTwo(page: Page) {
  await page.getByRole("button", { name: "Next: Your phone and home" }).click();
  await expect(page.getByText("Step 2 of 4 · Your phone and home")).toBeVisible();
  await expect(page.locator("#due-firstName")).toHaveValue("Dana");
  for (const [k, v] of Object.entries({ lastName: "Due", phone: "3055550122", street: "1500 Bay Rd", city: "Miami Beach" })) await page.fill(`#due-${k}`, v);
  // the server refuses forms finished in under 4 seconds (spam check)
  await page.waitForTimeout(4200);
}
async function details(page: Page) {
  await stepOne(page);
  await stepTwo(page);
}

function fakeReserve(page: Page) {
  const sent: Record<string, unknown>[] = [];
  return page
    .route("**/api/due-date", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (body.check) return route.continue();
      sent.push(body);
      return route.fulfill({ status: 201, json: { reference: "TH-D-20261111-TEST", status: "reserved", donePath: "/due-date/done?r=TH-D-20261111-TEST&k=x" } });
    })
    .then(() => sent);
}

test("home and ad page: “Book with my due date” is on the first screen and opens Not born yet (owner, Nov 12)", async ({ page }) => {
  for (const path of ["/", "/home-sweet-home"]) {
    await page.goto(path);
    const button = page.getByRole("main").getByRole("link", { name: "Book with my due date" }).first();
    await expect(button).toBeInViewport();
    await expect(button).toHaveAttribute("href", "/due-date");
    // its own color, not the white of the buttons next to it
    const [own, white] = await button.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(document.documentElement).getPropertyValue("--chalk-white")]);
    expect(own).not.toBe(white.trim());
  }
  await page.getByRole("main").getByRole("link", { name: "Book with my due date" }).first().click();
  await expect(page).toHaveURL(/\/due-date$/);
  await expect(page.getByRole("heading", { name: "Not born yet?", level: 1 })).toBeVisible();
});

test("Reserve my spot → backdrops → review with a discount code → the reservation carries both (owner, Nov 11)", async ({ page }) => {
  const sent = await fakeReserve(page);
  await page.route("**/api/booking/quote", (route) =>
    route.fulfill({ json: { quote: { bundleId: "our-little-story", bundleName: "Our Little Story", regularCents: 29900, offerCents: null, offerLabel: null, offerEndsOn: null, discountCode: "SAVE10", discountCents: 2990, finalCents: 26910, addons: [], addonsCents: 0, totalCents: 26910, pricingType: "discount", note: null } } }),
  );
  await stepOne(page);
  await expect(page.getByText("Step 1 of 4 · Your details")).toBeVisible();
  await expect(page.getByText("Pick your bundle and due date, then tell us your first name, email and ZIP code.", { exact: false })).toBeVisible();
  await stepTwo(page);
  await page.getByRole("button", { name: "Reserve my spot" }).click();

  // step 3: backdrops (two setups on Our Little Story)
  await expect(page.getByText("Step 3 of 4 · Backdrops")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick your backdrops", level: 2 })).toBeFocused();
  await page.getByRole("button", { name: "Pink", exact: true }).click();
  await page.getByRole("button", { name: "Cream", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  expect((await new AxeBuilder({ page }).withTags(WCAG_AA).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Next: Review" }).click();

  // step 4: review, the code, and the deposit
  await expect(page.getByText("Step 4 of 4 · Review and reserve")).toBeVisible();
  await expect(page.getByText("Pink, Cream", { exact: false })).toBeVisible();
  await page.getByLabel("Have a discount code?").fill("save10");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Code SAVE10 applied: -$29.90.")).toBeVisible();
  await expect(page.getByText("$269.10 with your code SAVE10 (regular $299), kept for you")).toBeVisible();
  await expect(page.getByText("Your code comes off what you pay after your session.", { exact: false })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(WCAG_AA).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: /Reserve my spot|Pay the .* deposit and reserve/ }).click();
  await page.waitForURL("**/due-date/done**");
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ bundleId: "our-little-story", backdrops: ["pink", "cream"], discountCode: "SAVE10", contact: { email: "dana.due@example.com", parentName: "Dana Due" } });
  expect(sent[0].check).toBeUndefined();
});

test("Not sure yet skips the backdrops; Back keeps what they typed; a wrong ZIP or a due date past 9 months stops step one", async ({ page }) => {
  const sent = await fakeReserve(page);
  await stepOne(page, "10001");
  await page.getByRole("button", { name: "Next: Your phone and home" }).click();
  await expect(page.getByText("We only come to homes in Florida", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Step 1 of 4 · Your details")).toBeVisible();
  await page.fill("#due-zip", "33139");
  // the 9-month limit
  const tooLate = await page.locator("#due-date").getAttribute("max").then((max) => new Date(new Date(`${max}T12:00:00Z`).getTime() + 2 * 864e5).toISOString().slice(0, 10));
  await page.fill("#due-date", tooLate);
  await page.getByRole("button", { name: "Next: Your phone and home" }).click();
  await expect(page.getByText("Pick your due date", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Step 1 of 4 · Your details")).toBeVisible();
  await page.fill("#due-date", new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10));
  await stepTwo(page);
  await page.getByRole("button", { name: "Reserve my spot" }).click();
  await page.getByRole("button", { name: "Not sure yet, I'll choose when I book my session" }).click();
  await expect(page.getByText("Not sure yet (you'll choose when you book your session)")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator("#due-lastName")).toHaveValue("Due");
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator("#due-firstName")).toHaveValue("Dana");
  await page.getByRole("button", { name: "Next: Your phone and home" }).click();
  await page.getByRole("button", { name: "Reserve my spot" }).click();
  await page.getByRole("button", { name: "Not sure yet, I'll choose when I book my session" }).click();
  await page.getByRole("button", { name: /Reserve my spot|Pay the .* deposit and reserve/ }).click();
  await page.waitForURL("**/due-date/done**");
  expect(sent[0]).toMatchObject({ backdrops: [] });
  expect(sent[0].discountCode).toBeUndefined();
});

test("Back from Stripe without paying lands on their reservation page, not an empty form; Reserve again starts over (owner, Nov 11)", async ({ page }) => {
  await page.route("**/api/due-date", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.check) return route.continue();
    // "Stripe" here is another page of the site; the reservation page is the signed done link
    return route.fulfill({ status: 201, json: { reference: "TH-D-20261111-BACK", status: "pending", depositUrl: "/bundles", donePath: "/due-date/done?r=TH-D-20261111-BACK&k=sig" } });
  });
  await details(page);
  await page.getByRole("button", { name: "Reserve my spot" }).click();
  await page.getByRole("button", { name: "Not sure yet, I'll choose when I book my session" }).click();
  await page.getByRole("button", { name: /Reserve my spot|Pay the .* deposit and reserve/ }).click();
  await page.waitForURL("**/bundles");
  await page.goBack();
  await page.waitForURL("**/due-date/done?r=TH-D-20261111-BACK**");
  // (here the fake reservation isn't a real one, so its page says the link isn't valid and forgets it; "Reserve
  // again" starts a new form)
  await expect(page.getByRole("link", { name: "Reserve again" })).toHaveAttribute("href", "/due-date?new=1");
  await page.goto("/due-date?new=1");
  await expect(page.getByText("Step 1 of 4 · Your details")).toBeVisible();
});
