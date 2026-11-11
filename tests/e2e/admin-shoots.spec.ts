import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addDaysKey } from "@/lib/booking/timezone";
import type { LeadList } from "@/lib/leads/types";
import { dayParts, todayMiami } from "@/lib/shoots/format";
import type { BringSection, ShootDay, ShootSummary } from "@/lib/shoots/types";
import { noDepositLead, signedInAdmin } from "./fixtures/admin";

/** /admin → Shoots, slice 2 (Shoot days, + Shoot without a booking, What we always bring, Leads button). APIs faked. */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const soon = addDaysKey(todayMiami(), 3);
const past = addDaysKey(todayMiami(), -4);

const shoot = (over: Partial<ShootSummary>): ShootSummary => ({
  key: "b-TH-20261103-4821",
  id: null,
  kind: "booking",
  date: soon,
  start: "09:00",
  end: "11:00",
  title: "The Morales family",
  tabLabel: "Morales",
  bundleLine: "Our Little Story · 2 h · 2 backdrops",
  bundleName: "Our Little Story",
  place: "Miami Beach",
  inspoCount: 6,
  btsCount: 3,
  status: "confirmed",
  ...over,
});

const DAYS: ShootDay[] = [
  {
    date: soon,
    sunset: "17:31",
    ticked: 0,
    total: 43,
    shoots: [
      shoot({}),
      shoot({ key: "b-TH-20261105-2290", title: "The Patel family", start: "13:00", bundleName: "Little Moments", inspoCount: 0, btsCount: 0 }),
    ],
  },
  { date: past, sunset: "17:35", ticked: 29, total: 29, shoots: [shoot({ key: "0b6f5a3e-1111-4222-8333-944455556666", kind: "styled", date: past, title: "First Christmas set test", bundleName: null, inspoCount: 2, btsCount: 1 })] },
];

const SECTIONS: BringSection[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Studio kit", items: ["Space heater", "Step stool"], sort: 0 },
  { id: "22222222-2222-4222-8222-222222222222", name: "Camera gear", items: ["Tripod"], sort: 1 },
];

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area (phone screenshots are separate)");
  await signedInAdmin(page);
});

async function fakeDays(page: Page, days: ShootDay[] = DAYS) {
  const requests: URL[] = [];
  await page.route("**/api/admin/shoots?*", (route) => {
    requests.push(new URL(route.request().url()));
    return route.fulfill({ json: { days } });
  });
  return requests;
}

test("Shoot days: menu entry after Leads, coming up / done cards, links to folders and day sheets", async ({ page }) => {
  const requests = await fakeDays(page);
  await page.goto("/admin/shoots");

  const menu = page.getByRole("navigation", { name: "Owner area" }).getByRole("link");
  await expect(menu.nth(1)).toHaveText("Leads");
  await expect(menu.nth(2)).toHaveText("Shoots");
  await expect(menu.nth(2)).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Shoots", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Shoots" }).getByRole("link", { name: "Shoot days" })).toHaveAttribute("aria-current", "page");

  const p = dayParts(soon);
  const upcoming = page.getByRole("region", { name: "Coming up" });
  await expect(upcoming.getByRole("heading", { name: `${p.weekday}, ${p.month} ${p.day}` })).toBeVisible();
  await expect(upcoming.getByText("2 shoots · sunset 5:31")).toBeVisible();
  await expect(upcoming.getByText("0 of 43 ticked")).toBeVisible();
  const morales = upcoming.getByRole("link", { name: /The Morales family/ });
  await expect(morales).toHaveAttribute("href", "/admin/shoots/folder/b-TH-20261103-4821");
  await expect(morales).toContainText("9:00");
  await expect(morales).toContainText("6 inspo");
  await expect(morales).toContainText("3 BTS ideas");
  await expect(upcoming.getByRole("link", { name: /The Patel family/ })).toContainText("No inspo yet");
  await expect(upcoming.getByRole("link", { name: "Open day sheet →" })).toHaveAttribute("href", `/admin/shoots/${soon}`);

  // done days are folded to one slim row (owner, Nov 11): the day, each shoot's time and title, "Open day sheet"
  const done = page.getByRole("region", { name: "Done" });
  const dp = dayParts(past);
  await expect(done.locator("summary")).toContainText("First Christmas set test");
  await expect(done.locator("summary")).toContainText("9:00");
  await expect(done.getByText("29 of 29 ticked")).toBeHidden();
  await expect(done.getByRole("link", { name: "Open day sheet →" })).toHaveAttribute("href", `/admin/shoots/${past}`);
  // a tap on the row shows the rest
  await done.getByRole("heading", { name: `${dp.weekday}, ${dp.month} ${dp.day}` }).click();
  await expect(done.getByRole("link", { name: /First Christmas set test/ })).toContainText("No booking");
  await expect(done.getByText("29 of 29 ticked")).toBeVisible();

  // one request: 60 days back to 330 ahead, Miami days
  expect(requests).toHaveLength(1);
  expect(requests[0].searchParams.get("from")).toBe(addDaysKey(todayMiami(), -60));
  expect(requests[0].searchParams.get("to")).toBe(addDaysKey(todayMiami(), 330));

  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);
});

test("+ Shoot without a booking: title, day, start, place → its folder", async ({ page }) => {
  await fakeDays(page, []);
  let posted: unknown = null;
  await page.route("**/api/admin/shoots", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    posted = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { shoot: { key: "0b6f5a3e-1111-4222-8333-944455556666" } } });
  });
  await page.route("**/admin/shoots/folder/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>folder</title><h1>Folder</h1>" }));
  await page.goto("/admin/shoots");
  await expect(page.getByText("No shoots coming up.")).toBeVisible();

  const toggle = page.getByRole("button", { name: "+ Shoot without a booking" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("What is it?")).toBeFocused();
  await page.getByLabel("What is it?").fill("Valentine's set test");
  await page.getByLabel("Day").fill("2027-02-01");
  await page.getByLabel("Starts").fill("16:30");
  await page.getByLabel("Where").fill("Our place, Miami Beach");
  await page.getByRole("button", { name: "Create the folder" }).click();
  await page.waitForURL("**/admin/shoots/folder/0b6f5a3e-1111-4222-8333-944455556666");
  expect(posted).toEqual({ title: "Valentine's set test", date: "2027-02-01", startTime: "16:30", place: "Our place, Miami Beach" });
});

test("before the migration runs, Shoots says so", async ({ page }) => {
  await page.route("**/api/admin/shoots?*", (route) => route.fulfill({ status: 503, json: { error: "Run the shoots migration", notReady: true } }));
  await page.goto("/admin/shoots");
  await expect(page.getByRole("alert").filter({ hasText: "isn't set up" })).toContainText("Run the shoots migration (drizzle/0024_shoots.sql)");
});

test("What we always bring: rename, fill, add a section, remove with two taps; saves by itself", async ({ page }) => {
  const patches: { id: string; body: unknown }[] = [];
  let removed: string | null = null;
  await page.route("**/api/admin/shoots/bring", async (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 201, json: { section: { id: "33333333-3333-4333-8333-333333333333", name: "", items: [], sort: 2 } } });
    return route.fulfill({ json: { sections: SECTIONS } });
  });
  await page.route("**/api/admin/shoots/bring/*", async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop()!;
    if (route.request().method() === "DELETE") {
      removed = id;
      return route.fulfill({ status: 204 });
    }
    patches.push({ id, body: route.request().postDataJSON() });
    return route.fulfill({ json: { section: SECTIONS[0] } });
  });

  await page.goto("/admin/shoots/bring");
  await expect(page.getByRole("navigation", { name: "Shoots" }).getByRole("link", { name: "What we always bring" })).toHaveAttribute("aria-current", "page");
  const kit = page.getByRole("region", { name: "Studio kit" });
  await expect(kit.getByLabel("What to bring")).toHaveValue("Space heater\nStep stool");

  // typing saves once, a moment after it stops
  await kit.getByLabel("What to bring").fill("Space heater\nStep stool\nWhite noise machine");
  await expect(page.getByRole("status")).toHaveText("Saved");
  expect(patches).toEqual([{ id: SECTIONS[0].id, body: { name: "Studio kit", items: "Space heater\nStep stool\nWhite noise machine" } }]);

  await page.getByRole("button", { name: "+ Add a section" }).click();
  const fresh = page.getByRole("region", { name: "New section" });
  await expect(fresh.getByLabel("Section name")).toBeFocused();
  await fresh.getByLabel("Section name").fill("Christmas props");
  await expect.poll(() => patches.at(-1)).toEqual({ id: "33333333-3333-4333-8333-333333333333", body: { name: "Christmas props", items: "" } });

  const gear = page.getByRole("region", { name: "Camera gear" });
  await gear.getByRole("button", { name: /Remove this section/ }).click();
  await expect(gear.getByRole("button", { name: /Tap again to remove/ })).toBeVisible();
  expect(removed).toBeNull();
  await gear.getByRole("button", { name: /Tap again to remove/ }).click();
  await expect(page.getByRole("region", { name: "Camera gear" })).toHaveCount(0);
  expect(removed).toBe(SECTIONS[1].id);
  await expect(page.getByRole("button", { name: "+ Add a section" })).toBeFocused();

  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);
});

test("What we always bring: a failed save keeps the text and retries", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/admin/shoots/bring", (route) => route.fulfill({ json: { sections: SECTIONS } }));
  await page.route("**/api/admin/shoots/bring/*", (route) => {
    calls += 1;
    return calls === 1 ? route.fulfill({ status: 500, json: { error: "Couldn't save that." } }) : route.fulfill({ json: { section: SECTIONS[1] } });
  });
  await page.goto("/admin/shoots/bring");
  await page.getByRole("region", { name: "Camera gear" }).getByLabel("Section name").fill("Camera gear + lenses");
  await expect(page.getByRole("status")).toHaveText("Not saved yet, retrying…");
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });
  expect(calls).toBe(2);
  await expect(page.getByRole("region", { name: "Camera gear + lenses" }).getByLabel("Section name")).toHaveValue("Camera gear + lenses");
});

test("Leads: Open shoot folder on bookings that aren't cancelled", async ({ page }) => {
  const cancelled = { ...noDepositLead, reference: "TH-20261008-GONE", parentName: "Cancelled Family", status: "cancelled" as const };
  const list: LeadList = { leads: [noDepositLead, cancelled], counts: { all: 2, pending: 0, confirmed: 1, rescheduled: 0, cancelled: 1 }, total: 2, money: { paidThisMonthCents: 0, unpaidCount: 0 } };
  await page.route("**/api/admin/leads?*", (route) => route.fulfill({ json: list }));
  await page.goto("/admin/leads");
  const open = page.getByRole("link", { name: "Open shoot folder" });
  await expect(open).toHaveCount(1);
  await expect(open).toHaveAttribute("href", "/admin/shoots/folder/b-TH-20261008-TEST");
});
