import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * "Get a quick price" (owner, Nov 13): home page under the hero, ad page under the bundle cards. A bundle + ZIP code →
 * today's price + the travel fee for that ZIP = the total, and a button to book that bundle. Travel answers are faked.
 */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const money = (text: string) => Number(text.replace(/[^0-9.]/g, ""));
const fakeTravel = (page: Page) =>
  page.route("**/api/booking/travel?zip=*", (route) => {
    const zip = new URL(route.request().url()).searchParams.get("zip");
    const base = { freeMiles: 25, perMileCents: 100, maxMiles: 250 };
    const travel = zip === "33401" ? { status: "fee", miles: 75, feeCents: 5000, ...base } : zip === "10001" ? { status: "outside_florida", miles: null, feeCents: 0, ...base } : { status: "free", miles: 3, feeCents: 0, ...base };
    return route.fulfill({ json: { travel } });
  });

test("home page: a bundle and a ZIP code give the total with travel; outside Florida says so", async ({ page }) => {
  await fakeTravel(page);
  await page.goto("/");
  const box = page.getByRole("region", { name: "Get a quick price" });
  await box.scrollIntoViewIfNeeded();
  await expect(box.getByRole("heading", { level: 2, name: "Get a quick price" })).toBeVisible();
  const bundles = box.getByRole("group", { name: "Bundle" });
  // the middle bundle to start
  await expect(bundles.getByRole("button", { name: /Our Little Story/ })).toHaveAttribute("aria-pressed", "true");
  await expect(box.getByText("add your ZIP code", { exact: true })).toBeVisible();

  await bundles.getByRole("button", { name: /Little Moments/ }).click();
  await expect(bundles.getByRole("button", { name: /Little Moments/ })).toHaveAttribute("aria-pressed", "true");
  const receipt = box.locator("dl");
  const price = money(await receipt.locator("dd b").first().innerText());
  expect(price).toBeGreaterThan(0);
  await box.getByLabel("Your ZIP code").fill("33401");
  await expect(receipt).toContainText("Travel to 33401");
  await expect(receipt).toContainText("$50");
  await expect(receipt).toContainText("about 75 miles");
  const total = box.getByText("Your total").locator("..");
  await expect.poll(async () => money(await total.innerText())).toBeCloseTo(price + 50, 2);
  await expect(box.getByRole("link", { name: "Book Little Moments" })).toHaveAttribute("href", /bundle=little-moments/);

  // a Miami Beach ZIP: no travel fee
  await box.getByLabel("Your ZIP code").fill("33139");
  await expect(receipt).toContainText("Free");
  await expect.poll(async () => money(await total.innerText())).toBeCloseTo(price, 2);

  await box.getByLabel("Your ZIP code").fill("10001");
  await expect(box.getByText("We only come to homes in Florida", { exact: false })).toBeVisible();
  await expect(total).toContainText("—");

  // the booking form's code box, loaded when asked for
  await box.getByRole("button", { name: "Have a discount code?" }).click();
  await expect(box.getByRole("button", { name: "Apply" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).include('section[aria-labelledby^="quick-price-"]').withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);
});

test("ad page: the quick price box sits right under the bundle cards", async ({ page }) => {
  await fakeTravel(page);
  await page.goto("/home-sweet-home");
  const offer = page.locator("#bundles");
  const box = offer.getByRole("region", { name: "Get a quick price" });
  await box.scrollIntoViewIfNeeded();
  await expect(box.getByRole("heading", { level: 3, name: "Get a quick price" })).toBeVisible();
  await box.getByLabel("Your ZIP code").fill("33139");
  await expect(box.locator("dl")).toContainText("Travel to 33139");
  await expect(box.getByRole("link", { name: /^Book / })).toHaveAttribute("href", /bundle=/);
});
