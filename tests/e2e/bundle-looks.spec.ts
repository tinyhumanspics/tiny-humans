import { expect, test, type Page } from "@playwright/test";
import type { RequestListItem } from "@/lib/requests/types";
import { signedInAdmin } from "./fixtures/admin";
import { hydrated } from "./fixtures/hydration";

/**
 * Owner, Nov 24: every bundle says what it includes, look by look (the bundles page, home, the ad page, and /book once a
 * bundle is picked); bundles with 2+ setups ask for prop ideas on /book, which the owner sees on the request.
 */

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser is enough for the copy (the request flow has its own phone tests)");
  await page.route("**/api/booking/funnel", (r) => r.fulfill({ status: 204 }));
});

test("the bundles page: each card lists its looks instead of the setups line", async ({ page }) => {
  await page.goto("/bundles");
  const card = (name: string) => page.getByRole("article", { name });
  await expect(card("Little Moments")).toContainText("1 look");
  await expect(card("Little Moments")).toContainText("Cozy Wrap: baby swaddled and sleeping on your choice of backdrop.");
  await expect(card("Our Little Story")).toContainText("2 looks");
  await expect(card("Our Little Story")).toContainText("Little Nest: a second backdrop with a prop, like a basket or tiny bed.");
  await expect(card("Our Family Story")).toContainText("3 looks plus family");
  await expect(card("Our Family Story")).toContainText("Family Hug: photos with mom, dad and siblings.");
  for (const name of ["Little Moments", "Our Little Story", "Our Family Story"]) await expect(card(name)).not.toContainText(/\d setups?/);
});

/** Screen 1 → screen 2 of /book with the first open time next month. */
async function toDetails(page: Page) {
  await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-busy", "false");
  await page.locator('button[aria-label*="available"]:not([disabled])').last().click();
  await page.locator('label[for^="time-"]').first().click();
  await page.getByRole("button", { name: "Next: your details" }).click();
  await expect(page.getByRole("heading", { name: "Where should we text you?" })).toBeFocused();
  await hydrated(page, "#request-firstName");
}

test("/book: the picked bundle's looks, and prop ideas for bundles with 2+ looks", async ({ page }) => {
  const posted: Record<string, unknown>[] = [];
  // the request itself isn't needed here: keep what the page sends and answer like a busy server
  await page.route("**/api/booking/request", (r) => {
    posted.push(r.request().postDataJSON());
    return r.fulfill({ status: 503, json: { error: "Try again in a minute." } });
  });
  await page.goto("/book?bundle=our-little-story");
  await expect(page.getByText("Our Little Story · 2 looks")).toBeVisible();
  await expect(page.getByText("Little Nest: a second backdrop with a prop, like a basket or tiny bed.")).toBeVisible();
  await toDetails(page);
  await expect(page.getByLabel("Prop ideas (optional)")).toBeVisible();
  for (const [k, v] of Object.entries({ firstName: "Dana", mobile: "305-555-0122", email: "dana.props@example.com", zip: "33139" })) await page.fill(`#request-${k}`, v);
  await page.getByLabel("Prop ideas (optional)").fill("  A wicker basket and something sage green  ");
  await page.waitForTimeout(3200);
  await page.getByRole("button", { name: "Request this time" }).click();
  await expect.poll(() => posted.at(-1)?.propIdeas).toBe("A wicker basket and something sage green");

  // Little Moments has one look: no prop ideas
  await page.goto("/book?bundle=little-moments");
  await expect(page.getByText("Little Moments · 1 look")).toBeVisible();
  await toDetails(page);
  await expect(page.getByLabel("Prop ideas (optional)")).toHaveCount(0);
});

test("Requests: the family's prop ideas are on their request", async ({ page }) => {
  await signedInAdmin(page);
  const item: RequestListItem = {
    id: "00000000-0000-4000-8000-000000000031", reference: "TH-R-20261124-3131", createdAt: new Date(Date.now() - 60_000).toISOString(), locale: "en",
    type: "date", status: "new", bundleId: "our-little-story", bundleName: "Our Little Story", babyCount: 1, totalCents: 29900,
    travelStatus: "free", travelMiles: 6, travelFeeCents: 0, slotDate: "2026-12-10", slotStart: "09:00", dueDate: null,
    holdUntil: new Date(Date.now() + 11 * 3600_000).toISOString(), firstName: "Dana", mobile: "(305) 555-0122", email: "dana.props@example.com",
    zip: "33139", propIdeas: "A wicker basket and something sage green", textConsent: true, made: null, hello: "Hi Dana", link: null,
  };
  await page.route("**/api/admin/requests", (r) => r.fulfill({ json: { requests: [item] } }));
  await page.goto("/admin/requests");
  await expect(page.getByText("Prop ideas: A wicker basket and something sage green")).toBeVisible();
});
