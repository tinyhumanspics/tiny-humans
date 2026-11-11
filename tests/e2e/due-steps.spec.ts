import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * "Not born yet?" in three steps (owner, Nov 11): details → backdrops (or "Not sure yet") → review with a discount
 * code → the deposit. Step one is checked by the real server (no database needed); the final reservation and the code
 * check are faked (mock mode has no database or codes).
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.beforeEach(async ({ page }) => {
  // never count steps or save drafts from a test
  await page.route("**/api/booking/draft", (r) => r.fulfill({ status: 204 }));
});

async function details(page: Page) {
  await page.goto("/due-date?bundle=our-little-story");
  await page.fill("#due-date", new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10));
  for (const [k, v] of Object.entries({ parentName: "Dana Due", email: "dana.due@example.com", phone: "3055550122", street: "1500 Bay Rd", city: "Miami Beach", zip: "33139" })) await page.fill(`#due-${k}`, v);
  // the server refuses forms finished in under 4 seconds (spam check)
  await page.waitForTimeout(4200);
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

test("Reserve my spot → backdrops → review with a discount code → the reservation carries both (owner, Nov 11)", async ({ page }) => {
  const sent = await fakeReserve(page);
  await page.route("**/api/booking/quote", (route) =>
    route.fulfill({ json: { quote: { bundleId: "our-little-story", bundleName: "Our Little Story", regularCents: 29900, offerCents: null, offerLabel: null, offerEndsOn: null, discountCode: "SAVE10", discountCents: 2990, finalCents: 26910, addons: [], addonsCents: 0, totalCents: 26910, pricingType: "discount", note: null } } }),
  );
  await details(page);
  await expect(page.getByText("Step 1 of 3 · Your details")).toBeVisible();
  await page.getByRole("button", { name: "Reserve my spot" }).click();

  // step 2: backdrops (two setups on Our Little Story)
  await expect(page.getByText("Step 2 of 3 · Backdrops")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick your backdrops", level: 2 })).toBeFocused();
  await page.getByRole("button", { name: "Pink", exact: true }).click();
  await page.getByRole("button", { name: "Cream", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  expect((await new AxeBuilder({ page }).withTags(WCAG_AA).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Next: Review" }).click();

  // step 3: review, the code, and the deposit
  await expect(page.getByText("Step 3 of 3 · Review and reserve")).toBeVisible();
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
  expect(sent[0]).toMatchObject({ bundleId: "our-little-story", backdrops: ["pink", "cream"], discountCode: "SAVE10", contact: { email: "dana.due@example.com" } });
  expect(sent[0].check).toBeUndefined();
});

test("Not sure yet skips the backdrops; Back keeps what they typed; a wrong ZIP stops step one", async ({ page }) => {
  const sent = await fakeReserve(page);
  await details(page);
  await page.fill("#due-zip", "10001");
  await page.getByRole("button", { name: "Reserve my spot" }).click();
  await expect(page.getByText("We only come to homes in Florida", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Step 1 of 3 · Your details")).toBeVisible();
  await page.fill("#due-zip", "33139");
  await page.getByRole("button", { name: "Reserve my spot" }).click();
  await page.getByRole("button", { name: "Not sure yet, I'll choose when I book my session" }).click();
  await expect(page.getByText("Not sure yet (you'll choose when you book your session)")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator("#due-parentName")).toHaveValue("Dana Due");
  await page.getByRole("button", { name: "Reserve my spot" }).click();
  await page.getByRole("button", { name: "Not sure yet, I'll choose when I book my session" }).click();
  await page.getByRole("button", { name: /Reserve my spot|Pay the .* deposit and reserve/ }).click();
  await page.waitForURL("**/due-date/done**");
  expect(sent[0]).toMatchObject({ backdrops: [] });
  expect(sent[0].discountCode).toBeUndefined();
});
