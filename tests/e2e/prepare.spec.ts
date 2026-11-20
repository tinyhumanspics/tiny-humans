import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { BackdropView } from "@/lib/booking/backdrop-page";
import { hydrated } from "./fixtures/hydration";

/**
 * "Prepare for your session" (/backdrop?t=…, brief 02): a booking made from a request has its ZIP code only; the family
 * adds the street, gate notes, the baby's name, backdrops and the photo permission on one page. API faked (the real
 * save is checked against scripts/local-db + fake Outlook).
 */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const view: BackdropView = {
  bundleId: "our-little-story",
  bundleName: "Our Little Story",
  date: "2026-12-01",
  start: "09:00",
  firstName: "Ana",
  setups: 2,
  picks: [],
  canChange: true,
  status: "active",
  home: { street: "", city: "", zip: "33139", accessNotes: "" },
  babyNames: [""],
  babyGenders: [""],
  photos: false,
};

test("Prepare for your session: home, baby's name, boy or girl, backdrops and photo permission in one save", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/booking/backdrop*", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { backdrop: view } });
    sent = route.request().postDataJSON() as Record<string, unknown>;
    const body = sent as { picks: string[]; home: { street: string; city: string; accessNotes: string }; babyNames: string[]; babyGenders: ("boy" | "girl" | "")[]; photos: boolean };
    return route.fulfill({ json: { backdrop: { ...view, picks: body.picks, home: { ...body.home, zip: "33139" }, babyNames: body.babyNames, babyGenders: body.babyGenders, photos: body.photos } } });
  });
  await page.goto("/backdrop?t=test-token-0123456789");
  await expect(page.getByRole("heading", { name: "Prepare for your session", level: 1 })).toBeVisible();
  await expect(page.getByText("Hi Ana! A few details for your Our Little Story session on Tuesday, December 1, 2026, 9:00 am.")).toBeVisible();
  await expect(page.getByText("ZIP code 33139. A different ZIP code? Text us at", { exact: false })).toBeVisible();
  await hydrated(page, "#prep-street");

  // the street is needed first
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Add your street address and city so we can find you.");
  expect(sent).toBeNull();

  await page.getByLabel("Street address (and apt or unit)").fill("1500 Bay Rd, Apt 4");
  await page.getByLabel("City").fill("Miami Beach");
  await page.getByLabel("Gate code, parking, anything we should know (optional)").fill("Gate 1234");
  await page.getByLabel("Baby's name (optional)").fill("Mia");
  // boy or girl (owner, Nov 19): optional
  await expect(page.getByLabel("Boy or girl (optional)")).toHaveValue("");
  await page.getByLabel("Boy or girl (optional)").selectOption({ label: "Girl" });
  await page.getByRole("group", { name: "Choose your backdrops" }).getByRole("button").first().click();
  await page.getByRole("checkbox", { name: /feature our photos/ }).check();
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("main").getByRole("status")).toHaveText("Saved! See you on Tuesday, December 1, 2026.");
  expect(sent).toEqual({ token: "test-token-0123456789", picks: ["blueAura"], home: { street: "1500 Bay Rd, Apt 4", city: "Miami Beach", accessNotes: "Gate 1234" }, babyNames: ["Mia"], babyGenders: ["girl"], photos: true });
});

test("the day before the session, the page says to text instead", async ({ page }) => {
  await page.route("**/api/booking/backdrop*", (route) => route.fulfill({ json: { backdrop: { ...view, canChange: false, picks: ["cream"] } } }));
  await page.goto("/backdrop?t=test-token-0123456789");
  await expect(page.getByText("Your session is very soon, so these details can't be changed online anymore.", { exact: false })).toBeVisible();
  await expect(page.getByText("Right now: Cream.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
});
