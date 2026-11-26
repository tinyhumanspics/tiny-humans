import { expect, test } from "@playwright/test";
import type { Dashboard, DashboardBucket } from "@/lib/admin/dashboard-types";
import { addDaysKey } from "@/lib/booking/timezone";
import type { LeadList } from "@/lib/leads/types";
import type { DiscountCode } from "@/lib/pricing/types";
import { devBundles as bundles } from "@/lib/pricing/dev-bundles";
import { noDepositLead, signedInAdmin } from "./fixtures/admin";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await signedInAdmin(page);
});

test("confirmations close with Escape, Cancel or a click outside, and give focus back", async ({ page }) => {
  const list: LeadList = { leads: [noDepositLead], counts: { all: 1, pending: 0, confirmed: 1, rescheduled: 0, cancelled: 0, completed: 0, past: 0, not_paid: 0 }, total: 1, money: { unpaidCount: 0 } };
  await page.route("**/api/admin/leads?*", (route) => route.fulfill({ json: list }));
  let deleteCalls = 0;
  await page.route("**/api/admin/leads/delete", (route) => {
    deleteCalls += 1;
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto("/admin/leads");
  await page.getByRole("button", { name: "View details" }).click();
  const opener = page.getByRole("button", { name: "Delete Lead" });
  const dialog = page.getByRole("alertdialog", { name: "Delete this lead permanently?" });

  await opener.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  await opener.click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await opener.click();
  await page.mouse.click(8, 8); // the dimmed backdrop
  await expect(dialog).toBeHidden();
  expect(deleteCalls).toBe(0);
});

test("a pricing confirmation deletes only after Delete Permanently", async ({ page }) => {
  const code: DiscountCode = { id: "c1", code: "SPRING10", type: "percent", value: 10, bundleIds: [], active: true, expiresOn: null, maxUses: null, onePerEmail: false, internalNote: null, category: null, usesCount: 0, createdAt: "2026-10-01T12:00:00.000Z" };
  await page.route("**/api/admin/deposit", (route) => route.fulfill({ json: { settings: null, stripeReady: true, databaseConfigured: true } }));
  await page.route("**/api/admin/pricing", (route) => route.fulfill({ json: { bundles, codes: [code], databaseConfigured: true } }));
  const deleted: string[] = [];
  await page.route("**/api/admin/pricing/codes?*", (route) => {
    if (route.request().method() === "DELETE") deleted.push(new URL(route.request().url()).searchParams.get("id") ?? "");
    return route.fulfill({ json: { codes: [] } });
  });

  await page.goto("/admin/pricing");
  const dialog = page.getByRole("alertdialog", { name: "Delete code SPRING10?" });
  await page.getByRole("row", { name: /SPRING10/ }).getByRole("button", { name: "Delete" }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(deleted).toEqual([]);

  await page.getByRole("row", { name: /SPRING10/ }).getByRole("button", { name: "Delete" }).click();
  await dialog.getByRole("button", { name: "Delete Permanently" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("SPRING10 deleted.")).toBeVisible();
  expect(deleted).toEqual(["c1"]);
});

test("the dashboard opens on this month, steps to other months and picks dates", async ({ page }) => {
  const day = (start: string, b: Partial<DashboardBucket> = {}): DashboardBucket => ({ start, paidCents: 0, bookedCents: 0, bookings: 0, leads: 0, shoots: 0, ...b });
  const month = (from: string, days: number, totals: Partial<Dashboard["totals"]>, buckets: Record<string, Partial<DashboardBucket>> = {}, leadMonths: Dashboard["leadMonths"] = []): Dashboard => ({
    today: "2026-11-25",
    upcoming: [
      { reference: "TH-1", date: "2026-11-25", start: "09:00", end: "10:00", parentName: "Maria Lopez", bundleName: "Little Moments", location: "1500 Bay Rd, Miami Beach, FL 33139", status: "confirmed" },
      { reference: "TH-2", date: "2026-11-26", start: "13:00", end: "15:00", parentName: "Ana Diaz", bundleName: "Our Little Story", location: "10 Ocean Dr, Miami Beach, FL 33139", status: "rescheduled" },
    ],
    period: { from, to: addDaysKey(from, days - 1), unit: days <= 31 ? "day" : "week" },
    totals: { paidCents: 0, paid: { depositCents: 0, sessionCents: 0, extrasCents: 0, extrasOrders: 0 }, bookedCents: 0, bookings: 0, leads: 0, leadsBooked: 0, leadsWaiting: 0, shoots: 0, shootsCents: 0, toCollectCents: 0, leadsFor: 0, leadsForBooked: 0, leadsForWaiting: 0, ...totals },
    leadMonths,
    buckets: Array.from({ length: days <= 31 ? days : Math.ceil(days / 7) }, (_, i) => {
      const start = addDaysKey(from, days <= 31 ? i : 7 * i);
      return day(start, buckets[start]);
    }),
    bundles: [{ label: "Little Moments", bookings: 3, revenueCents: 44700 }, { label: "Our Little Story", bookings: 1, revenueCents: 34900 }],
    sources: [{ label: "Meta ads", bookings: 3, revenueCents: 54700 }, { label: "Direct", bookings: 1, revenueCents: 24900 }],
    changes: { cancelled: 1, depositNotPaid: 2, rescheduled: 1 },
    emails: { sent: 5, failed: 0, problems: 1 },
  });
  const november = month(
    "2026-11-01",
    30,
    { paidCents: 34400, paid: { depositCents: 10000, sessionCents: 19900, extrasCents: 4500, extrasOrders: 1 }, bookedCents: 79600, bookings: 4, leads: 9, leadsBooked: 4, leadsWaiting: 2 },
    { "2026-11-14": { paidCents: 19900, bookings: 2, bookedCents: 49800, leads: 3 } },
    [
      { month: "2026-11", leads: 5, booked: 3 },
      { month: "2026-12", leads: 4, booked: 1 },
    ],
  );
  const october = month("2026-10-01", 31, { paidCents: 25000, paid: { depositCents: 5000, sessionCents: 20000, extrasCents: 0, extrasOrders: 0 }, bookedCents: 24900, bookings: 1, leads: 3, leadsBooked: 1, leadsWaiting: 0 });
  const december = month("2026-12-01", 31, { shoots: 2, shootsCents: 74800, toCollectCents: 64800, leadsFor: 6, leadsForBooked: 2, leadsForWaiting: 3 }, { "2026-12-05": { shoots: 1 }, "2026-12-12": { shoots: 1 } });
  const asked: string[] = [];
  await page.route("**/api/admin/dashboard*", (route) => {
    const q = new URL(route.request().url()).searchParams;
    asked.push(q.toString());
    if (!q.has("from")) return route.fulfill({ json: november });
    if (q.get("from") === "2026-10-01") return route.fulfill({ json: october });
    if (q.get("from") === "2026-12-01") return route.fulfill({ json: december });
    return route.fulfill({ json: month(q.get("from")!, 45, { paidCents: 59400, bookings: 5, leads: 12 }) });
  });
  await page.route("**/api/admin/leads?*", (route) => route.fulfill({ json: { leads: [], counts: { all: 4, pending: 0, confirmed: 3, rescheduled: 1, cancelled: 1, completed: 0, past: 0, not_paid: 0 }, total: 4, money: { unpaidCount: 2 } } }));

  await page.goto("/admin");
  const comingUp = page.getByRole("region", { name: "Coming up" });
  await expect(comingUp.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(comingUp.getByText("Rescheduled", { exact: true })).toBeVisible();

  // this month first: money, bookings and leads
  const numbers = page.getByRole("region", { name: "November 2026" });
  await expect(numbers.getByRole("heading", { name: "This month so far" })).toBeVisible();
  await expect(numbers.getByText("$344", { exact: true })).toBeVisible();
  await expect(numbers.getByText("$796 full price, still on")).toBeVisible();
  // the new leads by the month they want (owner, Nov 25)
  const wanted = numbers.getByRole("list", { name: "New leads by the month they want" });
  await expect(wanted.getByText("4 leads · 1 booked")).toBeVisible();
  await expect(wanted.getByText("December", { exact: true })).toBeVisible();
  await expect(numbers.getByText("4 booked · 2 waiting for you")).toBeVisible();
  await expect(numbers.getByText(/Paid: \$100 deposits · \$199 session payments · \$45 photo extras \(1 order\)/)).toBeVisible();
  await expect(numbers.getByRole("button", { name: "Next month: December 2026" })).toBeEnabled();
  await expect(numbers.getByRole("button", { name: "This month" })).toHaveCount(0);
  expect(asked).toEqual([""]);

  const chart = page.getByRole("region", { name: "By day" });
  await expect(chart.getByRole("button", { name: "Paid" })).toHaveAttribute("aria-pressed", "true");
  await chart.getByRole("button", { name: "Leads" }).click();
  await expect(chart.getByRole("button", { name: "Leads" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Where bookings come from" }).getByText("Meta ads")).toBeVisible();
  await expect(page.getByRole("region", { name: "By bundle" }).getByText("3 · $447")).toBeVisible();
  await expect(page.getByRole("region", { name: "Changes and emails" }).getByText("Deposit not paid (time released)")).toBeVisible();
  await expect(page.getByText("Sessions not paid yet")).toBeVisible();

  // the month before
  await numbers.getByRole("button", { name: "Previous month: October 2026" }).click();
  const octoberNumbers = page.getByRole("region", { name: "October 2026" });
  await expect(octoberNumbers.getByRole("heading", { name: "During October" })).toBeVisible();
  await expect(octoberNumbers.getByText("$250", { exact: true })).toBeVisible();
  expect(asked.at(-1)).toBe("from=2026-10-01&to=2026-10-31");

  // any dates; a bad pair is caught before asking
  await octoberNumbers.getByRole("button", { name: "Pick dates" }).click();
  await octoberNumbers.getByLabel("From").fill("2026-10-15");
  await octoberNumbers.getByLabel("To").fill("2026-10-10");
  await octoberNumbers.getByRole("button", { name: "Show" }).click();
  await expect(octoberNumbers.getByRole("alert")).toHaveText("The end date is before the start date.");
  await octoberNumbers.getByLabel("To").fill("2026-11-28");
  await octoberNumbers.getByRole("button", { name: "Show" }).click();
  const range = page.getByRole("region", { name: "Oct 15 – Nov 28, 2026" });
  await expect(range.getByRole("heading", { name: "During these dates" })).toBeVisible();
  await expect(page.getByRole("region", { name: "By week" })).toBeVisible();
  expect(asked.at(-1)).toBe("from=2026-10-15&to=2026-11-28");

  // and back
  await range.getByRole("button", { name: "This month" }).click();
  await expect(page.getByRole("region", { name: "November 2026" }).getByRole("heading", { name: "This month so far" })).toBeVisible();

  // a coming month shows the shoots already on the calendar (owner, Nov 25)
  await page.getByRole("region", { name: "November 2026" }).getByRole("button", { name: "Next month: December 2026" }).click();
  const decemberNumbers = page.getByRole("region", { name: "December 2026" });
  await expect(decemberNumbers.getByRole("heading", { name: "For December" })).toBeVisible();
  await expect(decemberNumbers.getByText("Leads for December", { exact: true })).toBeVisible();
  await expect(decemberNumbers.getByText("2 booked · 3 waiting for you")).toBeVisible();
  await expect(decemberNumbers.getByText("$648", { exact: true })).toBeVisible();
  await expect(decemberNumbers.getByText(/Still to come/)).toBeVisible();
  expect(asked.at(-1)).toBe("from=2026-12-01&to=2026-12-31");
  await page.getByRole("region", { name: "By day" }).getByRole("button", { name: "Shoots" }).click();
  await expect(page.getByRole("region", { name: "By day" }).getByText("Shoots on your calendar each day.")).toBeVisible();
});
