import { expect, test } from "@playwright/test";
import type { Lead, LeadList } from "@/lib/leads/types";
import { noDepositLead, signedInAdmin } from "./fixtures/admin";

// the session happened and the sneak peek went out, so the "Gallery delivered" box shows
const lead: Lead = {
  ...noDepositLead,
  after: { ...noDepositLead.after!, started: true, ended: true, sessionDone: { status: "sent", at: "2026-10-27T17:42:00.000Z", error: null } },
};
const list: LeadList = { leads: [lead], counts: { all: 1, pending: 0, confirmed: 1, rescheduled: 0, cancelled: 0 }, total: 1, money: { paidThisMonthCents: 0, unpaidCount: 0 } };

test("Gallery delivered sends the download PIN with the gallery link", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await signedInAdmin(page);
  const sentLead: Lead = { ...lead, after: { ...lead.after!, gallery: { status: "sent", at: "2026-10-29T15:00:00.000Z", error: null } } };
  const sent: unknown[] = [];
  // after a send, /admin reloads the list: the fake server answers like the real one
  await page.route("**/api/admin/leads?*", (route) => route.fulfill({ json: sent.length ? { ...list, leads: [sentLead] } : list }));
  await page.route("**/api/admin/leads/gallery", (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ json: { lead: sentLead } });
  });

  await page.goto("/admin/leads");
  await page.getByRole("button", { name: "View details" }).click();
  await page.getByLabel("Final gallery link (optional)").fill("https://tinyhumans.pixieset.com/family/");
  await page.getByLabel("Download PIN (optional)").fill(" 4821 ");
  await expect(page.getByText("and the download PIN 4821", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Gallery delivered: send review request" }).click();

  await expect(page.locator("dt", { hasText: "Gallery + review email" }).locator("+ dd")).toHaveText(/^Sent /);
  expect(sent).toEqual([{ reference: lead.reference, galleryUrl: "https://tinyhumans.pixieset.com/family/", downloadPin: "4821" }]);
});

test("without a PIN the request stays as before", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await signedInAdmin(page);
  await page.route("**/api/admin/leads?*", (route) => route.fulfill({ json: list }));
  const sent: unknown[] = [];
  await page.route("**/api/admin/leads/gallery", (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ json: { lead } });
  });

  await page.goto("/admin/leads");
  await page.getByRole("button", { name: "View details" }).click();
  await expect(page.getByText("Sends a thank-you with a link to leave a review, plus a $149 payment button (still unpaid).")).toBeVisible();
  await page.getByRole("button", { name: "Gallery delivered: send review request" }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ reference: lead.reference });
});
