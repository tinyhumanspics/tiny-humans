import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { DepositReturnState, LinkDetails } from "@/lib/deposit/types";

/**
 * The pay link of a booking the owner confirmed (Requests), decision #22: the $50 first (the total with travel and the
 * refund line above the button), then on the same page the mom's home address, her baby's age and her backdrops.
 * APIs faked (the real flow is checked against scripts/local-db + fake Stripe).
 */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() + 9 * 864e5));
const LINK = "/book?bundle=our-little-story&deposit=TH-20261112-4459&k=sig";
// the page shows the link's details, not the confirmation, so the booking itself isn't read
const paid = (link: LinkDetails) => ({ state: "confirmed", booking: {}, link }) as unknown as DepositReturnState;

test("the mom's link before paying: her time, the total with travel, the refund line above the button, then Stripe", async ({ page }) => {
  const waiting: DepositReturnState = { state: "waiting", amountCents: 5000, holdUntil: new Date(Date.now() + 47 * 3_600_000).toISOString(), date: day, start: "13:00", end: "15:00", bundleName: "Our Little Story", payUrl: null, name: "Ana", totalCents: 33900, noticeHours: 48 };
  await page.route("**/api/booking/deposit/status?*", (route) => route.fulfill({ json: waiting }));
  await page.route("**/api/booking/deposit/pay", (route) => route.fulfill({ json: { url: "http://localhost:3100/fake-stripe-page" } }));
  await page.route("**/fake-stripe-page", (route) => route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><title>Stripe</title><h1>Stripe page</h1></html>' }));
  await page.goto(LINK);
  await expect(page.getByRole("heading", { name: "Your time is saved, Ana." })).toBeVisible();
  await expect(page.getByText(/^Our Little Story · .+ at 1:00 pm · at your home\. Total \$339 \(travel included\)\. Pay the \$50 deposit to book it\. The rest is paid after your session\. We're holding this time until .+ \(Miami time\)\.$/i)).toBeVisible();
  const refund = page.getByText("Refundable up to 48 h before your session. Card payment on Stripe.");
  const pay = page.getByRole("button", { name: "Pay $50 and book my session" });
  await expect(pay).toBeEnabled();
  // the refund line sits above the button (decision #22)
  expect((await refund.boundingBox())!.y).toBeLessThan((await pay.boundingBox())!.y);
  // nothing to fill in before paying
  await expect(page.getByLabel("Street address (and apt or unit)")).toHaveCount(0);
  await expect(page.getByText("Need a different time? Text us at", { exact: false })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);
  await pay.click();
  await page.waitForURL("**/fake-stripe-page");
});

test("the mom's link after paying: her home address (owner, Nov 16), her baby's age (required, Nov 20) and name and boy or girl (optional, Nov 19), then her backdrops (two for Our Little Story)", async ({ page }) => {
  await page.route("**/api/booking/deposit/status?*", (route) => route.fulfill({ json: paid({ name: "Ana", backdrops: { allowed: 2, picks: [] }, home: { street: "", city: "", zip: "33139", accessNotes: "" }, babies: [{ name: "", gender: "", age: "" }] }) }));
  const homes: unknown[] = [];
  await page.route("**/api/booking/deposit/home", (route) => {
    const body = route.request().postDataJSON() as { b: string; k: string; home: { street: string; city: string; accessNotes: string }; babies?: { name: string; gender: string; age: string }[] };
    homes.push(body);
    return route.fulfill({ json: { home: { ...body.home, zip: "33139" }, babies: body.babies ?? [] } });
  });
  const saved: unknown[] = [];
  await page.route("**/api/booking/deposit/backdrops", (route) => {
    const body = route.request().postDataJSON() as { b: string; k: string; picks: string[] };
    saved.push(body);
    return route.fulfill({ json: { picks: body.picks } });
  });
  await page.goto(`${LINK}&paid=1`);
  await expect(page.getByRole("heading", { name: "You're booked!" })).toBeVisible();
  await expect(page.getByText("Two quick things so we come ready: your home address and your baby's age (it tells us which outfits to bring). Backdrops can wait.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pay / })).toHaveCount(0);
  // 1. her home: no texting the address (the ZIP is the request's)
  await expect(page.getByRole("heading", { name: "1. Your home and baby" })).toBeVisible();
  await expect(page.getByText("ZIP code 33139.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).first().click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Add your street address and city so we can find you.");
  await page.getByLabel("Street address (and apt or unit)").fill("1500 Bay Rd, Apt 1204");
  await page.getByLabel("City").fill("Miami Beach");
  await page.getByLabel(/Gate code, parking/).fill("Gate 4321");
  // her baby: the age is required (owner, Nov 20), the name and boy or girl optional (Nov 19)
  await expect(page.getByRole("group", { name: "Your baby" })).toBeVisible();
  await page.getByLabel("Baby's name (optional)").fill("Mia");
  await expect(page.getByLabel("Boy or girl (optional)").locator("option")).toHaveText(["Choose…", "Boy", "Girl"]);
  await page.getByLabel("Boy or girl (optional)").selectOption({ label: "Girl" });
  await page.getByRole("button", { name: "Save and continue" }).first().click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Choose your baby's age, so we bring the right outfits and props.");
  await expect(page.getByLabel("How old is your baby?")).toBeFocused();
  expect(homes).toEqual([]);
  await expect(page.getByLabel("How old is your baby?").locator("option")).toHaveText(["Choose…", "Newborn (0–2 weeks)", "2–6 weeks", "6 weeks – 3 months", "3–6 months", "6–12 months", "1–2 years", "Not born yet"]);
  await page.getByLabel("How old is your baby?").selectOption({ label: "Newborn (0–2 weeks)" });
  // a real form: Enter in a box saves it
  await page.getByLabel("City").press("Enter");
  await expect(page.getByText("We'll come to 1500 Bay Rd, Apt 1204, Miami Beach, FL 33139. For Mia · Girl · Newborn (0–2 weeks).")).toBeVisible();
  expect(homes).toEqual([{ b: "TH-20261112-4459", k: "sig", home: { street: "1500 Bay Rd, Apt 1204", city: "Miami Beach", accessNotes: "Gate 4321" }, babies: [{ name: "Mia", gender: "girl", age: "Newborn (0–2 weeks)" }] }]);
  // 2. her backdrops
  await expect(page.getByRole("heading", { name: "2. Your backdrops" })).toBeVisible();
  const picker = page.getByRole("group", { name: "Pick your backdrops" });
  await picker.getByRole("button").nth(0).click();
  await picker.getByRole("button").nth(4).click();
  // a third one doesn't fit Our Little Story (two setups)
  await picker.getByRole("button").nth(5).click();
  await expect(picker.locator('button[aria-pressed="true"]')).toHaveCount(2);
  expect(saved).toEqual([]);
  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);

  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText(/^Saved: /)).toBeVisible();
  expect(saved).toEqual([{ b: "TH-20261112-4459", k: "sig", picks: expect.arrayContaining([]) }]);
  expect((saved[0] as { picks: string[] }).picks).toHaveLength(2);
});

test("the mom's link after paying: “Not sure yet” skips the backdrops; Change brings them back", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-safari", "One phone covers it");
  await page.route("**/api/booking/deposit/status?*", (route) =>
    route.fulfill({ json: paid({ name: "Ana", backdrops: { allowed: 1, picks: [] }, home: { street: "1500 Bay Rd", city: "Miami Beach", zip: "33139", accessNotes: "" }, babies: [] }) }),
  );
  await page.goto("/book?bundle=little-moments&deposit=TH-20261112-0001&k=sig");
  // an address already on the booking (saved on an earlier visit) shows as saved
  await expect(page.getByText("We'll come to 1500 Bay Rd, Miami Beach, FL 33139.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "2. Your backdrop" })).toBeVisible();
  await page.getByRole("button", { name: "Not sure yet, I'll choose later" }).click();
  await expect(page.getByText("No backdrop yet: you can choose it later from your confirmation email.")).toBeVisible();
  await page.getByRole("button", { name: "Change" }).last().click();
  await expect(page.getByRole("group", { name: "Pick your backdrop" })).toBeVisible();
});
