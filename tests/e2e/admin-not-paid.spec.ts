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
    const body = route.request().postDataJSON() as { reference: string };
    sent.depositLink.push(body);
    return route.fulfill({ json: { lead: body.reference === HELD.reference ? HELD : RELEASED } });
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
  // Bea already got one: her card shows the sent pill and "Send again" instead of the first button
  const bea = page.getByRole("listitem").filter({ hasText: "Bea Released" });
  await expect(bea.getByRole("status")).toHaveText("✓ Deposit reminder sent");
  await expect(bea.getByText("Sent once · last Nov 10, 2026, 3:05 PM")).toBeVisible();
  await expect(bea.getByRole("button", { name: "Send the deposit reminder again to Bea Released" })).toHaveText("Send again");
  await expect(page.getByRole("heading", { name: "Not born yet (1)" })).toBeVisible();
  const due = page.getByRole("list", { name: "Not born yet, deposit not paid" }).getByRole("listitem");
  await expect(due).toHaveCount(1);
  await expect(due.getByText("$50 deposit not paid")).toBeVisible();
  await expect(due.getByText("The payment page ran out before they paid.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Email deposit reminder to/ })).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);
});

test("Email deposit reminder: the button turns into “✓ Deposit reminder sent” (owner, Nov 11), and Send again resends", async ({ page }) => {
  const sent = await fake(page);
  await page.goto("/admin/leads");
  await page.getByRole("button", { name: "Not paid (3)" }).click();
  const ana = page.getByRole("listitem").filter({ hasText: "Ana Held" });
  await ana.getByRole("button", { name: "Email deposit reminder to Ana Held" }).click();
  await expect(ana.getByRole("status")).toHaveText("✓ Deposit reminder sent");
  await expect(ana.getByText(/^Sent once · last /)).toBeVisible();
  await expect(ana.getByRole("button", { name: "Email deposit reminder to Ana Held" })).toHaveCount(0);
  // no note at the top of the page any more: the card itself says it
  await expect(page.getByText("Deposit reminder emailed to", { exact: false })).toHaveCount(0);
  expect(sent.depositLink).toEqual([{ reference: HELD.reference, email: true }]);
  // a deliberate second reminder
  await page.getByRole("button", { name: "Send the deposit reminder again to Bea Released" }).click();
  await expect.poll(() => sent.depositLink.length).toBe(2);
  expect(sent.depositLink[1]).toEqual({ reference: RELEASED.reference, email: true });

  const camila = page.getByRole("list", { name: "Not born yet, deposit not paid" }).getByRole("listitem");
  await camila.getByRole("button", { name: "Email deposit reminder to Camila Reyes" }).click();
  await expect(camila.getByRole("status")).toHaveText("✓ Deposit reminder sent");
  expect(sent.due).toEqual([{ action: "remind", id: DUE.id }]);
});

test("Delete in Not paid: a Not born yet reservation (after confirming) and a booking's Delete opens the same dialog (owner, Nov 11)", async ({ page }) => {
  const sent = await fake(page);
  await page.goto("/admin/leads");
  await page.getByRole("button", { name: "Not paid (3)" }).click();
  await page.getByRole("button", { name: "Delete Camila Reyes" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete this reservation permanently?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete Permanently" }).click();
  await expect.poll(() => sent.due).toEqual([{ action: "delete", id: DUE.id }]);
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Delete Ana Held" }).click();
  await expect(page.getByRole("alertdialog", { name: "Delete this lead permanently?" })).toBeVisible();
});
