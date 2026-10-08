import { expect, test, type Page } from "@playwright/test";
import { bundles } from "@/config/bundles";
import { defaultSettings } from "@/lib/settings/defaults";
import type { Lead, LeadList } from "@/lib/leads/types";

async function signedInAdmin(page: Page) {
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({ json: { authenticated: true, authConfigured: true, storageConfigured: true } }),
  );
  await page.route("**/api/admin/settings", (route) => route.fulfill({ json: defaultSettings }));
}

test("turning deposits off is clearly unsaved until the owner saves it", async ({ page }, testInfo) => {
  await signedInAdmin(page);
  await page.route("**/api/admin/pricing", (route) => route.fulfill({ json: { bundles, codes: [], databaseConfigured: true } }));

  let enabled = true;
  await page.route("**/api/admin/deposit", async (route) => {
    if (route.request().method() === "PUT") enabled = Boolean(route.request().postDataJSON().enabled);
    await route.fulfill({
      json: {
        settings: { enabled, amounts: Object.fromEntries(bundles.map((bundle) => [bundle.id, 5000])) },
        stripeReady: true,
        databaseConfigured: true,
      },
    });
  });

  await page.goto("/admin/pricing");
  const toggle = page.getByRole("checkbox", { name: "Require a deposit for new bookings" });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page.getByText(/This switch has not been saved yet/)).toBeVisible();
  await page.getByRole("button", { name: "Save deposit settings" }).click();

  await expect(page.getByText("Deposits off and saved: new bookings are confirmed immediately")).toBeVisible();
  await expect(page.getByText("Deposits are off and saved: new bookings show Confirmed")).toBeVisible();
  expect(enabled).toBe(false);
  if (process.env.CAPTURE_APPROVAL === "1") await page.screenshot({ path: testInfo.outputPath("pricing-deposits-off.png"), fullPage: true });
});

const noDepositLead: Lead = {
  reference: "TH-20261008-TEST",
  status: "confirmed",
  parentName: "No Deposit Family",
  email: "family@example.com",
  phone: "3055550100",
  babyName: null,
  babyAge: "Newborn (0–2 weeks)",
  babies: [{ age: "Newborn (0–2 weeks)" }],
  bundleId: "little-moments",
  bundleName: "Little Moments",
  pricing: {
    regularCents: 14900,
    offerCents: null,
    offerLabel: null,
    discountCode: null,
    discountCents: 0,
    finalCents: 14900,
    addons: [],
    addonsCents: 0,
    totalCents: 14900,
    pricingType: "regular",
  },
  sessionDate: "2026-11-10",
  start: "10:00",
  end: "11:00",
  locationType: "client_home",
  address: "1500 Bay Rd, Miami Beach, FL 33139",
  notes: null,
  inspirationPhotoId: null,
  calendarLinked: true,
  confirmationEmail: { sent: true, at: "2026-10-08T16:00:00.000Z", error: null },
  internalNotification: { sent: true, at: "2026-10-08T16:00:00.000Z", error: null },
  history: [],
  reminders: [],
  after: {
    canSend: true,
    started: false,
    ended: false,
    sessionDone: null,
    favorites: "8",
    gallery: null,
    payment: {
      amountCents: 14900,
      next: { kind: "balance", amountCents: 14900 },
      status: "unpaid",
      paidAt: null,
      link: "https://www.tinyhumans.photography/pay?b=TH-20261008-TEST&s=test",
      linkEmail: null,
    },
    review: null,
  },
  deposit: null,
  consents: { sms: false, smsAt: null, photos: false, photosAt: null },
  cancellation: null,
  source: null,
  createdAt: "2026-10-08T16:00:00.000Z",
};

test("a deposits-off lead is confirmed and keeps its permanent payment and email tools", async ({ page }, testInfo) => {
  await signedInAdmin(page);
  const list: LeadList = {
    leads: [noDepositLead],
    counts: { all: 1, pending: 0, confirmed: 1, rescheduled: 0, cancelled: 0 },
    total: 1,
    money: { paidThisMonthCents: 0, unpaidCount: 0 },
  };
  await page.route("**/api/admin/leads?*", (route) => route.fulfill({ json: list }));

  await page.goto("/admin/leads");
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(page.getByText("Waiting for deposit", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "View details" }).click();

  await expect(page.getByText("Not required for this booking ($0 paid today)")).toBeVisible();
  await expect(page.getByText(/Created automatically when the booking was confirmed.*never expires/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send sneak peek" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Email the link" })).toBeVisible();
  await expect(page.getByText(/held until/)).toHaveCount(0);
  if (process.env.CAPTURE_APPROVAL === "1") await page.screenshot({ path: testInfo.outputPath("lead-without-deposit.png"), fullPage: true });
});
