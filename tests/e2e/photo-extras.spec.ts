import { expect, test, type Page } from "@playwright/test";
import type { Lead, LeadList } from "@/lib/leads/types";
import type { ExtraLine, ExtrasView } from "@/lib/photo-extras/types";
import { noDepositLead, signedInAdmin } from "./fixtures/admin";

// Photo extras after the session (owner, Nov 20). The server is faked here: it prices again and talks to Stripe.
const prices = { extraPhotoCents: 1300, maxExtras: 6, fullGalleryCents: 25000, rawFilesCents: 11500 };
const fresh = { extrasLeft: 6, canFull: true, canRaw: true, fullCreditCents: 0, nothingLeft: false };
const delivery = { extras: { amount: 72, unit: "hours" as const, withGallery: true }, full: { amount: 5, unit: "days" as const }, raw: { amount: 48, unit: "hours" as const } };
const view = (over: Partial<Extract<ExtrasView, { firstName: string }>> = {}): ExtrasView => ({ state: "open", firstName: "Sofia", bundleName: "Our Little Story", included: "20", prices, left: fresh, delivery, ...over });
const bought: ExtraLine[] = [
  { kind: "extra_photos", quantity: 4, unitCents: 1300, totalCents: 5200, delivery: { amount: 72, unit: "hours" } },
  { kind: "unedited_files", quantity: 1, unitCents: 11500, totalCents: 11500, delivery: { amount: 48, unit: "hours" } },
];
const LINK = "/extras?b=TH-20261205-4821&s=abcdefghijklmnopqrstuv";

async function fakeServer(page: Page, answers: { get: (paid: boolean) => ExtrasView; post?: (body: unknown) => object }) {
  const posted: unknown[] = [];
  await page.route("**/api/extras?*", (route) => route.fulfill({ json: answers.get(new URL(route.request().url()).searchParams.get("paid") === "1") }));
  await page.route("**/api/extras", (route) => {
    const body = route.request().postDataJSON();
    posted.push(body);
    return route.fulfill({ json: answers.post?.(body) ?? { url: `${LINK}&paid=1` } });
  });
  return posted;
}

test("pick 4 extra photos and the unedited files, pay, and see when they arrive", async ({ page }) => {
  let paid = false;
  const posted = await fakeServer(page, { get: (back) => (back && paid ? view({ state: "paid", left: { ...fresh, extrasLeft: 2, canRaw: false, fullCreditCents: 5200 }, paidOrder: { lines: bought, creditCents: 0, totalCents: 16700 } }) : view()), post: () => ((paid = true), { url: `${LINK}&paid=1` }) });
  await page.goto(LINK);
  await expect(page.getByRole("heading", { name: "Sofia, add more photos" })).toBeVisible();
  await expect(page.getByText("Our Little Story includes 20 edited photos.")).toBeVisible();
  // when each arrives (owner, Nov 20)
  await expect(page.getByText("Arrives with your finished gallery.")).toBeVisible();
  await expect(page.getByText("Arrives within 5 days.")).toBeVisible();
  await expect(page.getByText("Arrives within 48 hours.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pay/ })).toBeDisabled();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "One more" }).click();
  await page.getByRole("checkbox", { name: /Unedited files/ }).check();
  await expect(page.getByRole("button", { name: "Pay $167" })).toBeEnabled();
  // the full gallery resets and disables the extra photos
  await page.getByRole("checkbox", { name: /Full gallery/ }).check();
  await expect(page.getByRole("button", { name: "One more" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Pay $365" })).toBeVisible();
  await page.getByRole("checkbox", { name: /Full gallery/ }).uncheck();
  await expect(page.getByRole("button", { name: "Pay $115" })).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "One more" }).click();
  await page.getByLabel(/Anything we should know/).fill("The one with the teddy");
  await page.getByRole("button", { name: "Pay $167" }).click();
  await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible();
  expect(posted).toEqual([{ b: "TH-20261205-4821", s: "abcdefghijklmnopqrstuv", extras: 4, full: false, raw: true, note: "The one with the teddy" }]);
  await expect(page.getByText("Extra edited photos × 4")).toBeVisible();
  await expect(page.getByText("$52 · arrives within 72 hours")).toBeVisible();
  await expect(page.getByText("$115 · arrives within 48 hours")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add something else" })).toBeVisible();
});

test("opening the link again shows only what's left, with the credit on the full gallery", async ({ page }) => {
  // after the finished gallery: extra photos take their own 72 hours
  await fakeServer(page, { get: () => view({ left: { extrasLeft: 2, canFull: true, canRaw: false, fullCreditCents: 5200, nothingLeft: false }, delivery: { ...delivery, extras: { amount: 72, unit: "hours" } } }) });
  await page.goto(LINK);
  await expect(page.getByText("Arrives within 72 hours.")).toBeVisible();
  await expect(page.getByText("Up to 2")).toBeVisible();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "One more" }).click();
  await expect(page.getByRole("button", { name: "One more" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: /Unedited files/ })).toBeDisabled();
  await expect(page.getByText("Already yours")).toBeVisible();
  await expect(page.getByText("$198")).toBeVisible();
  await expect(page.getByText("−$52 already paid for extra photos")).toBeVisible();
});

test("closed, nothing left, and a link that doesn't work", async ({ page }) => {
  let answer: ExtrasView = { state: "closed" };
  await fakeServer(page, { get: () => answer });
  await page.goto(LINK);
  await expect(page.getByRole("heading", { name: "This page is closed" })).toBeVisible();
  await expect(page.getByText("Text us at (786) 222-7194")).toBeVisible();
  answer = view({ state: "nothing", left: { extrasLeft: 0, canFull: false, canRaw: false, fullCreditCents: 0, nothingLeft: true } });
  await page.reload();
  await expect(page.getByRole("heading", { name: "You have everything already" })).toBeVisible();
  await page.goto("/extras");
  await expect(page.getByRole("heading", { name: "This link doesn't work" })).toBeVisible();
});

test("a lead shows its extras, the totals, and the Delivered tick", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await signedInAdmin(page);
  const order = { id: "0b8f2a52-6d0e-4a8e-9f3e-2f1c5c0b7a11", lines: bought, creditCents: 0, totalCents: 16700, note: "The one with the teddy", status: "paid" as const, createdAt: "2026-11-20T20:00:00.000Z", paidAt: "2026-11-20T20:05:00.000Z", deliveredAt: null as string | null };
  const lead = (deliveredAt: string | null): Lead => ({ ...noDepositLead, extras: { link: `https://example.com${LINK}`, orders: [{ ...order, deliveredAt }], paidCents: 16700, sessionTotalCents: 14900, sessionPaidCents: 14900 } });
  const ticks: unknown[] = [];
  let delivered: string | null = null;
  // the list reloads after the tick: it answers with what's saved
  await page.route("**/api/admin/leads?*", (route) =>
    route.fulfill({ json: { leads: [lead(delivered)], counts: { all: 1, pending: 0, confirmed: 1, rescheduled: 0, cancelled: 0, completed: 0, past: 0, not_paid: 0 }, total: 1, money: { paidThisMonthCents: 0, unpaidCount: 0 } } satisfies LeadList }),
  );
  await page.route("**/api/admin/leads/extras-delivered", (route) => {
    ticks.push(route.request().postDataJSON());
    delivered = "2026-11-21T15:00:00.000Z";
    return route.fulfill({ json: { lead: lead(delivered) } });
  });
  await page.goto("/admin/leads");
  // the card says it before opening the lead (owner, Nov 20)
  await expect(page.getByText("Extras $167 · to deliver")).toBeVisible();
  await page.getByRole("button", { name: "View details" }).click();
  await expect(page.getByText("$149 ($149 paid)")).toBeVisible();
  await expect(page.getByText("$167", { exact: true })).toBeVisible();
  await expect(page.getByText("$316")).toBeVisible();
  await expect(page.getByText("Extra edited photos × 4 ($52), Unedited RAW files ($115)")).toBeVisible();
  await expect(page.getByText("Their note: “The one with the teddy”")).toBeVisible();
  await page.getByRole("checkbox", { name: "Delivered" }).check();
  await expect(page.getByText(/^Delivered Nov 21/)).toBeVisible();
  await expect(page.getByText("Extras $167 · delivered")).toBeVisible();
  expect(ticks).toEqual([{ reference: noDepositLead.reference, orderId: order.id, delivered: true }]);
  await expect(page.getByRole("link", { name: "Text the extras link" })).toBeVisible();
});

test("a lead card shows extras a family started but didn't pay, and nothing when they bought none", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await signedInAdmin(page);
  const started: Lead = { ...noDepositLead, extras: { link: null, orders: [{ id: "1d3c6c2a-7a7e-4f2b-9c1e-5b0f3c8d9e10", lines: bought.slice(0, 1), creditCents: 0, totalCents: 5200, note: null, status: "open", createdAt: "2026-11-20T20:00:00.000Z", paidAt: null, deliveredAt: null }], paidCents: 0, sessionTotalCents: 14900, sessionPaidCents: 0 } };
  const none: Lead = { ...noDepositLead, reference: "TH-20261008-NONE", parentName: "No Extras Family", extras: { link: null, orders: [], paidCents: 0, sessionTotalCents: 14900, sessionPaidCents: 0 } };
  await page.route("**/api/admin/leads?*", (route) =>
    route.fulfill({ json: { leads: [started, none], counts: { all: 2, pending: 0, confirmed: 2, rescheduled: 0, cancelled: 0, completed: 0, past: 0, not_paid: 0 }, total: 2, money: { paidThisMonthCents: 0, unpaidCount: 0 } } satisfies LeadList }),
  );
  await page.goto("/admin/leads");
  await expect(page.getByRole("listitem").filter({ hasText: noDepositLead.parentName }).getByText("Extras not paid")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "No Extras Family" }).getByText(/^Extras/)).toHaveCount(0);
});
