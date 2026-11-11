import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Lead, LeadDeposit, LeadList, NotPaidDue } from "@/lib/leads/types";
import { noDepositLead, signedInAdmin } from "./fixtures/admin";

/** /admin → Leads → Not paid (owner, Nov 11): families missing the deposit + "Email deposit reminder". APIs faked. */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const deposit = (over: Partial<LeadDeposit>): LeadDeposit => ({
  amountCents: 5000,
  status: "pending",
  paidAt: null,
  refundedAt: null,
  refundError: null,
  holdUntil: null,
  late: false,
  abandonedEmail: null,
  link: null,
  linkEmail: null,
  reminders: null,
  ...over,
});

const HELD: Lead = { ...noDepositLead, reference: "TH-20261111-HELD", parentName: "Ana Held", email: "ana@example.com", status: "pending", sessionDate: "2026-12-04", deposit: deposit({ holdUntil: "2026-11-11T17:30:00.000Z", link: "http://localhost/deposit" }) };
const RELEASED: Lead = {
  ...noDepositLead,
  reference: "TH-20261110-GONE",
  parentName: "Bea Released",
  email: "bea@example.com",
  status: "cancelled",
  sessionDate: "2026-12-10",
  deposit: deposit({ status: "expired", reminders: { count: 1, last: { status: "sent", at: "2026-11-10T20:05:00.000Z", error: null } } }),
};
const DUE: NotPaidDue = {
  id: "7a1e2f30-1111-4222-8333-944455556666",
  reference: "TH-D-20261109-7Q2K",
  parentName: "Camila Reyes",
  email: "camila@example.com",
  phone: "3055550199",
  bundleName: "Our Little Story",
  dueDate: "2027-01-20",
  depositCents: 5000,
  why: "expired",
  createdAt: "2026-11-09T15:00:00.000Z",
  reminders: null,
};

async function fake(page: Page) {
  const sent = { depositLink: [] as unknown[], due: [] as unknown[] };
  await signedInAdmin(page);
  await page.route("**/api/admin/due-dates", (route) => {
    if (route.request().method() === "POST") {
      sent.due.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { reservations: [], ready: true } });
  });
  await page.route("**/api/admin/leads?*", (route) => {
    const status = new URL(route.request().url()).searchParams.get("status");
    const notPaid = status === "not_paid";
    const leads = notPaid ? [HELD, RELEASED] : status === "all" ? [HELD] : [];
    return route.fulfill({
      json: {
        leads,
        counts: { all: 1, pending: 1, confirmed: 0, rescheduled: 0, cancelled: 1, completed: 0, not_paid: 3 },
        total: leads.length,
        money: { paidThisMonthCents: 0, unpaidCount: 0 },
        ...(notPaid ? { notPaidDue: [DUE] } : {}),
      } satisfies LeadList,
    });
  });
  await page.route("**/api/admin/leads/deposit-link", (route) => {
    sent.depositLink.push(route.request().postDataJSON());
    return route.fulfill({ json: { lead: RELEASED } });
  });
  return sent;
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
});

test("Not paid lists only the families missing the deposit, bookings and Not born yet (owner, Nov 11)", async ({ page }) => {
  await fake(page);
  await page.goto("/admin/leads");
  await page.getByRole("button", { name: "Not paid (3)" }).click();
  await expect(page.getByText("Families who haven't paid their deposit yet.", { exact: false })).toBeVisible();
  await expect(page.getByText("Waiting for the $50 deposit: their time is held until 12:30 PM.")).toBeVisible();
  await expect(page.getByText("Didn't pay the $50 deposit in time, so their time was released.")).toBeVisible();
  await expect(page.getByText("1 reminder sent · last Nov 10, 2026, 3:05 PM", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not born yet (1)" })).toBeVisible();
  const due = page.getByRole("list", { name: "Not born yet, deposit not paid" }).getByRole("listitem");
  await expect(due).toHaveCount(1);
  await expect(due.getByText("$50 deposit not paid")).toBeVisible();
  await expect(due.getByText("The payment page ran out before they paid.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Email deposit reminder to/ })).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);
});

test("Email deposit reminder: a booking holds its time again and emails the link; a Not born yet family gets theirs", async ({ page }) => {
  const sent = await fake(page);
  await page.goto("/admin/leads");
  await page.getByRole("button", { name: "Not paid (3)" }).click();
  await page.getByRole("button", { name: "Email deposit reminder to Bea Released" }).click();
  await expect(page.getByText("Deposit reminder emailed to Bea Released (bea@example.com).")).toBeVisible();
  expect(sent.depositLink).toEqual([{ reference: RELEASED.reference, email: true }]);
  await page.getByRole("button", { name: "Email deposit reminder to Camila Reyes" }).click();
  await expect(page.getByText("Deposit reminder emailed to Camila Reyes (camila@example.com).")).toBeVisible();
  expect(sent.due).toEqual([{ action: "remind", id: DUE.id }]);
});
