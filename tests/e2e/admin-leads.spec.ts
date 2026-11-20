import { expect, test } from "@playwright/test";
import { defaultSettings } from "@/lib/settings/defaults";
import type { LeadList } from "@/lib/leads/types";

const list = (all: number): LeadList => ({
  leads: [],
  counts: { all, pending: 0, confirmed: 0, rescheduled: 0, cancelled: 0, completed: 0, past: 0, not_paid: 0 },
  total: 0,
  money: { paidThisMonthCents: 0, unpaidCount: 0 },
});

test("Leads opens on Confirmed (owner, Nov 20); a quick filter change keeps the newest leads list", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({ json: { authenticated: true, authConfigured: true, storageConfigured: true } }),
  );
  await page.route("**/api/admin/settings", (route) => route.fulfill({ json: defaultSettings }));
  // the first ("Confirmed", where it opens) answer is slow; the owner switches to "All" before it arrives
  const asked: (string | null)[] = [];
  await page.route("**/api/admin/leads?*", async (route) => {
    const status = new URL(route.request().url()).searchParams.get("status");
    asked.push(status);
    if (status === "confirmed") {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return route.fulfill({ json: list(7) });
    }
    return route.fulfill({ json: list(3) });
  });

  await page.goto("/admin/leads");
  await expect(page.getByRole("button", { name: /^Confirmed/ })).toHaveAttribute("aria-pressed", "true");
  expect(asked[0]).toBe("confirmed");
  await page.getByRole("button", { name: /^All/ }).click();
  await expect(page.getByRole("button", { name: "All (3)" })).toBeVisible();
  await page.waitForTimeout(3000); // the old filter's answer arrives and must be ignored
  await expect(page.getByRole("button", { name: "All (3)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "All (3)" })).toHaveAttribute("aria-pressed", "true");
});

test("Completed: tap the pill before the status and the lead moves to Completed (owner, Nov 11)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  const { noDepositLead, signedInAdmin } = await import("./fixtures/admin");
  await signedInAdmin(page);
  let completedAt: string | null = null;
  const posted: unknown[] = [];
  await page.route("**/api/admin/leads?*", (route) => {
    const status = new URL(route.request().url()).searchParams.get("status");
    const lead = { ...noDepositLead, completedAt };
    const done = Boolean(completedAt);
    const leads = status === "completed" ? (done ? [lead] : []) : status === "confirmed" ? (done ? [] : [lead]) : status === "all" ? [lead] : [];
    return route.fulfill({
      json: { leads, counts: { all: 1, pending: 0, confirmed: done ? 0 : 1, rescheduled: 0, cancelled: 0, completed: done ? 1 : 0, past: 0, not_paid: 0 }, total: leads.length, money: { paidThisMonthCents: 0, unpaidCount: 0 } } satisfies LeadList,
    });
  });
  await page.route("**/api/admin/leads/complete", (route) => {
    const body = route.request().postDataJSON() as { reference: string; completed: boolean };
    posted.push(body);
    completedAt = body.completed ? "2026-11-11T12:00:00.000Z" : null;
    return route.fulfill({ json: { lead: { ...noDepositLead, completedAt } } });
  });

  await page.goto("/admin/leads");
  await expect(page.getByRole("button", { name: "Completed (0)" })).toBeVisible();
  const pill = page.getByRole("button", { name: `Completed: ${noDepositLead.parentName}` });
  await expect(pill).toHaveAttribute("aria-pressed", "false");
  await pill.click();
  await expect(page.getByText(`${noDepositLead.parentName} moved to Completed.`)).toBeVisible();
  expect(posted).toEqual([{ reference: noDepositLead.reference, completed: true }]);
  await expect(page.getByRole("button", { name: "Completed (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmed (0)" })).toBeVisible();

  await page.getByRole("button", { name: "Completed (1)" }).click();
  await expect(page.getByRole("button", { name: `Completed: ${noDepositLead.parentName}` })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: `Completed: ${noDepositLead.parentName}` })).toHaveText("✓ Completed");
  // tapping it again moves it back
  await page.getByRole("button", { name: `Completed: ${noDepositLead.parentName}` }).click();
  await expect(page.getByText(`${noDepositLead.parentName} moved back to Confirmed.`)).toBeVisible();
  expect(posted.at(-1)).toEqual({ reference: noDepositLead.reference, completed: false });
});

test("Confirmed: the next sessions on top, the ones whose date passed under Date passed; a Past section (owner, Nov 19)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  const { noDepositLead, signedInAdmin } = await import("./fixtures/admin");
  const { addDaysKey, todayInZone } = await import("@/lib/booking/timezone");
  await signedInAdmin(page);
  const today = todayInZone("America/New_York");
  const next = { ...noDepositLead, reference: "TH-NEXT", parentName: "Next Family", sessionDate: addDaysKey(today, 3) };
  const passed = { ...noDepositLead, reference: "TH-PASSED", parentName: "Passed Family", sessionDate: addDaysKey(today, -2) };
  const old = { ...noDepositLead, reference: "TH-OLD", parentName: "Old Family", sessionDate: addDaysKey(today, -30) };
  const statuses: string[] = [];
  await page.route("**/api/admin/leads?*", (route) => {
    const status = new URL(route.request().url()).searchParams.get("status") ?? "";
    statuses.push(status);
    const leads = status === "confirmed" ? [next, passed] : status === "past" ? [old] : [next, passed, old];
    return route.fulfill({
      json: { leads, counts: { all: 3, pending: 0, confirmed: 2, rescheduled: 0, cancelled: 0, completed: 0, past: 1, not_paid: 0 }, total: leads.length, money: { paidThisMonthCents: 0, unpaidCount: 0 } } satisfies LeadList,
    });
  });

  await page.goto("/admin/leads");
  await page.getByRole("button", { name: "Confirmed (2)" }).click();
  const lists = page.locator("ul").filter({ has: page.getByText(/Family/) });
  await expect(lists).toHaveCount(2);
  await expect(lists.first()).toContainText("Next Family");
  await expect(lists.first()).not.toContainText("Passed Family");
  await expect(page.getByRole("heading", { name: "Date passed" })).toBeVisible();
  await expect(lists.last()).toContainText("Passed Family");

  await page.getByRole("button", { name: "Past (1)" }).click();
  await expect(page.getByText(/more than 10 days ago, latest first/)).toBeVisible();
  await expect(page.getByText("Old Family")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Date passed" })).toHaveCount(0);
  expect(statuses).toContain("past");
});
