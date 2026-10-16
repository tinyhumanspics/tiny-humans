import type { Page } from "@playwright/test";
import { defaultSettings } from "@/lib/settings/defaults";
import type { Lead } from "@/lib/leads/types";

/** The owner area, signed in, with the default settings. Tests fake every other /api/admin route they need. */
export async function signedInAdmin(page: Page) {
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({ json: { authenticated: true, authConfigured: true, storageConfigured: true } }),
  );
  await page.route("**/api/admin/settings", (route) => route.fulfill({ json: defaultSettings }));
}

/** A confirmed booking without a deposit, as GET /api/admin/leads returns it. */
export const noDepositLead: Lead = {
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
