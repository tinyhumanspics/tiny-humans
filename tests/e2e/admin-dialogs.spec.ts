import { expect, test } from "@playwright/test";
import type { Dashboard } from "@/lib/admin/dashboard-types";
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
  const list: LeadList = { leads: [noDepositLead], counts: { all: 1, pending: 0, confirmed: 1, rescheduled: 0, cancelled: 0 }, total: 1, money: { paidThisMonthCents: 0, unpaidCount: 0 } };
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
  const code: DiscountCode = { id: "c1", code: "SPRING10", type: "percent", value: 10, bundleIds: [], active: true, expiresOn: null, maxUses: null, onePerEmail: false, internalNote: null, usesCount: 0, createdAt: "2026-10-01T12:00:00.000Z" };
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

test("the dashboard shows sessions coming up, weekly bookings, shares and changes", async ({ page }) => {
  const weeks = Array.from({ length: 12 }, (_, i) => ({ weekStart: addDaysKey("2026-07-27", 7 * i), bookings: 0, revenueCents: 0 }));
  weeks[10] = { weekStart: "2026-10-05", bookings: 3, revenueCents: 54700 };
  weeks[11] = { weekStart: "2026-10-12", bookings: 1, revenueCents: 24900 };
  const dashboard: Dashboard = {
    today: "2026-10-15",
    upcoming: [
      { reference: "TH-1", date: "2026-10-15", start: "09:00", end: "10:00", parentName: "Maria Lopez", bundleName: "Little Moments", location: "1500 Bay Rd, Miami Beach, FL 33139", status: "confirmed" },
      { reference: "TH-2", date: "2026-10-16", start: "13:00", end: "15:00", parentName: "Ana Diaz", bundleName: "Our Little Story", location: "10 Ocean Dr, Miami Beach, FL 33139", status: "rescheduled" },
    ],
    weeks,
    bundles: [{ label: "Little Moments", bookings: 3, revenueCents: 44700 }, { label: "Our Little Story", bookings: 1, revenueCents: 34900 }],
    sources: [{ label: "Meta ads", bookings: 3, revenueCents: 54700 }, { label: "Direct", bookings: 1, revenueCents: 24900 }],
    changes: { cancelled: 1, depositNotPaid: 2, rescheduled: 1 },
    emails: { days: 30, sent: 5, failed: 0, problems: 1 },
  };
  await page.route("**/api/admin/dashboard", (route) => route.fulfill({ json: dashboard }));
  await page.route("**/api/admin/leads?*", (route) => route.fulfill({ json: { leads: [], counts: { all: 4, pending: 0, confirmed: 3, rescheduled: 1, cancelled: 1 }, total: 4, money: { paidThisMonthCents: 0, unpaidCount: 0 } } }));

  await page.goto("/admin");
  const comingUp = page.getByRole("region", { name: "Coming up" });
  await expect(comingUp.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(comingUp.getByRole("heading", { name: "Tomorrow" })).toBeVisible();
  await expect(comingUp.getByText("9:00 am – 10:00 am")).toBeVisible();
  await expect(comingUp.getByText("Rescheduled", { exact: true })).toBeVisible();

  const weeksChart = page.getByRole("region", { name: "Bookings by week" });
  await expect(weeksChart.getByText(/Last 12 weeks: 4 bookings · \$796 booked/)).toBeVisible();
  await expect(weeksChart.getByRole("button", { name: "Bookings" })).toHaveAttribute("aria-pressed", "true");
  await weeksChart.getByRole("button", { name: "Booked total" }).click();
  await expect(weeksChart.getByRole("button", { name: "Booked total" })).toHaveAttribute("aria-pressed", "true");

  await expect(page.getByRole("region", { name: "Where bookings come from" }).getByText("Meta ads")).toBeVisible();
  await expect(page.getByRole("region", { name: "By bundle" }).getByText("3 · $447")).toBeVisible();
  await expect(page.getByRole("region", { name: "Changes and emails" }).getByText("Deposit not paid (time released)")).toBeVisible();
});
