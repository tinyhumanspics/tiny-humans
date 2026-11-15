import { expect, test } from "@playwright/test";
import type { UnfinishedData } from "@/lib/unfinished/types";
import { signedInAdmin } from "./fixtures/admin";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers these pages");
});

const TOKEN = "a".repeat(43);

test("'What stopped you?' saves the reasons and comment", async ({ page }) => {
  let saved: unknown = null;
  await page.route("**/api/feedback?*", (route) => route.fulfill({ json: { firstName: "Ana", reasons: [], comment: "" } }));
  await page.route("**/api/feedback", (route) => {
    saved = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto(`/feedback?t=${TOKEN}`);
  await expect(page.getByRole("heading", { name: "What stopped you, Ana?" })).toBeVisible();
  await page.getByRole("button", { name: "Send my answer" }).click();
  await expect(page.locator("#feedback-error")).toHaveText("Pick at least one answer, or tell us in the box below.");
  await page.getByLabel("The travel fee").check();
  await page.getByLabel("The dates or times didn't work for me").check();
  await page.getByLabel("Anything else you'd like to tell us?").fill("Orlando was too far for the price.");
  await page.getByRole("button", { name: "Send my answer" }).click();
  await expect(page.getByRole("heading", { name: "Thank you, Ana!" })).toBeVisible();
  expect(saved).toEqual({ token: TOKEN, reasons: ["travel_fee", "dates"], comment: "Orlando was too far for the price." });
});

test("a broken link explains what to do; unsubscribe needs a button press", async ({ page }) => {
  await page.route("**/api/feedback?*", (route) => route.fulfill({ status: 404, json: { error: "x" } }));
  await page.goto(`/feedback?t=${TOKEN}`);
  await expect(page.getByRole("heading", { name: "This link isn't working" })).toBeVisible();

  let calls = 0;
  await page.route("**/api/unsubscribe", (route) => {
    calls++;
    return route.fulfill({ json: { ok: true } });
  });
  // (Spanish pages need the database's Spanish bundles, so e2e checks the English one)
  await page.goto(`/unsubscribe?t=${TOKEN}`);
  await expect(page.getByRole("heading", { name: "Unsubscribe from our emails" })).toBeVisible();
  expect(calls, "opening the link alone doesn't unsubscribe (email scanners open links)").toBe(0);
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByRole("heading", { name: "You're unsubscribed" })).toBeVisible();
  expect(calls).toBe(1);
});

const data = (over: Partial<UnfinishedData> = {}): UnfinishedData => ({
  ready: true,
  bookedLater: 1,
  mailingAddress: null,
  answered: 1,
  reasons: [{ reason: "travel_fee", count: 1 }],
  funnel: {
    days: 7,
    source: null,
    sources: ["Meta ads", "Direct"],
    steps: [
      { step: "calendar", count: 12 },
      { step: "date", count: 6 },
      { step: "time", count: 4 },
      { step: "details", count: 2 },
      { step: "booked", count: 0 },
    ],
  },
  items: [
    {
      id: "6f1d2c3b-1111-4222-8333-944455556666",
      email: "maria@example.com",
      parentName: "Maria Lopez",
      phone: "3055550111",
      bundleName: "Little Moments",
      sessionDate: "2026-11-16",
      start: "10:00",
      zip: "32801",
      travelFeeCents: 25100,
      form: "booking",
      stage: "review",
      locale: "en",
      source: "Meta ads",
      campaign: "Newborn Nov",
      attempts: 1,
      firstSeen: "2026-11-03T15:00:00.000Z",
      lastSeen: "2026-11-03T15:04:00.000Z",
      reference: null,
      followUp: null,
      unsubscribed: false,
      feedback: { reasons: ["travel_fee"], comment: "Too far for us.", at: "2026-11-04T15:00:00.000Z" },
    },
  ],
  ...over,
});

test("/admin → Unfinished bookings: step counts, answers, and the email only once a mailing address is saved", async ({ page }) => {
  await signedInAdmin(page);
  let current = data();
  const sent: unknown[] = [];
  const periods: string[] = [];
  await page.route("**/api/admin/unfinished?*", async (route) => {
    const url = new URL(route.request().url());
    periods.push(`${url.searchParams.get("days")}|${url.searchParams.get("source") ?? ""}`);
    if (route.request().method() === "PUT") current = data({ mailingAddress: (route.request().postDataJSON() as { mailingAddress: string }).mailingAddress });
    return route.fulfill({ json: current });
  });
  await page.route("**/api/admin/unfinished/follow-up?*", (route) => {
    sent.push(route.request().postDataJSON());
    current = data({ mailingAddress: current.mailingAddress, items: current.items.map((i) => ({ ...i, followUp: { status: "sent", at: "2026-11-05T15:00:00.000Z", error: null } })) });
    return route.fulfill({ json: { data: current, sent: 1, failed: 0, skipped: 0 } });
  });

  await page.goto("/admin/unfinished");
  await expect(page.getByRole("heading", { name: "Unfinished bookings", level: 1 })).toBeVisible();
  // opens on the last 7 days (owner, Nov 6)
  await expect(page.getByRole("button", { name: "Last 7 days" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => periods[0]).toBe("7|");
  await expect(page.getByText("Opened the booking form (what Meta counts as a checkout)")).toBeVisible();
  await expect(page.getByText("2 · 17%")).toBeVisible();
  await expect(page.getByText("Maria Lopez")).toBeVisible();
  await expect(page.getByText("picked Monday, November 16, 2026, 10:00 AM", { exact: false })).toBeVisible();
  await expect(page.getByText("“Too far for us.”")).toBeVisible();

  // the email stays off until the mailing address is saved
  const sendOne = page.getByRole("button", { name: "Send “What stopped you?” email" });
  await expect(sendOne).toBeDisabled();
  await expect(page.getByRole("button", { name: "Send to everyone not contacted yet (1)" })).toBeDisabled();
  await page.getByLabel("Mailing address for marketing emails").fill("PO Box 123, Miami Beach, FL 33139");
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByText("Mailing address saved.")).toBeVisible();
  await expect(sendOne).toBeEnabled();
  await sendOne.click();
  await expect(page.getByText("Email sent to Maria Lopez.")).toBeVisible();
  await expect(page.getByText("“What stopped you?” email: sent", { exact: false })).toBeVisible();
  expect(sent).toEqual([{ id: "6f1d2c3b-1111-4222-8333-944455556666" }]);

  await page.getByLabel("From").selectOption("Meta ads");
  await page.getByRole("button", { name: "Last 30 days" }).click();
  await expect.poll(() => periods.at(-1)).toBe("30|Meta ads");
});

test("/admin → Unfinished bookings: a family from \"Not born yet?\" is labeled, with where to find the reservation", async ({ page }) => {
  await signedInAdmin(page);
  const dueFamily: UnfinishedData["items"][number] = {
    id: "7a2e3d4c-2222-4333-8444-a55566667777",
    email: "dana@example.com",
    parentName: "Dana Due",
    phone: "3055550122",
    bundleName: "Our Little Story",
    sessionDate: null,
    start: null,
    zip: "33139",
    travelFeeCents: 0,
    form: "due_date",
    stage: "deposit",
    locale: "en",
    source: "Direct",
    campaign: null,
    attempts: 1,
    firstSeen: "2026-11-03T16:00:00.000Z",
    lastSeen: "2026-11-03T16:02:00.000Z",
    reference: "TH-D-20261103-1234",
    followUp: null,
    unsubscribed: false,
    feedback: null,
  };
  await page.route("**/api/admin/unfinished?*", (route) => route.fulfill({ json: data({ items: [...data().items, dueFamily] }) }));
  await page.goto("/admin/unfinished");
  const dana = page.locator("li", { hasText: "Dana Due" });
  await expect(dana.getByText("Not born yet · due-date form")).toBeVisible();
  await expect(dana.getByText("Didn't pay the deposit")).toBeVisible();
  await expect(dana.getByText("TH-D-20261103-1234 (under Leads → Due dates, deposit not paid)", { exact: false })).toBeVisible();
  // the booking-form family has no label
  await expect(page.locator("li", { hasText: "Maria Lopez" }).getByText("Not born yet · due-date form")).toHaveCount(0);
});
