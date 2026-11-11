import { expect, test } from "@playwright/test";
import { defaultSettings } from "@/lib/settings/defaults";
import type { LeadList } from "@/lib/leads/types";

const list = (all: number): LeadList => ({
  leads: [],
  counts: { all, pending: 0, confirmed: 0, rescheduled: 0, cancelled: 0, completed: 0, not_paid: 0 },
  total: 0,
  money: { paidThisMonthCents: 0, unpaidCount: 0 },
});

test("a quick filter change keeps the newest leads list", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({ json: { authenticated: true, authConfigured: true, storageConfigured: true } }),
  );
  await page.route("**/api/admin/settings", (route) => route.fulfill({ json: defaultSettings }));
  // the first ("All") answer is slow; the owner switches to "Confirmed" before it arrives
  await page.route("**/api/admin/leads?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("status") === "all") {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return route.fulfill({ json: list(7) });
    }
    return route.fulfill({ json: list(3) });
  });

  await page.goto("/admin/leads");
  await page.getByRole("button", { name: /^Confirmed/ }).click();
  await expect(page.getByRole("button", { name: "All (3)" })).toBeVisible();
  await page.waitForTimeout(3000); // the old filter's answer arrives and must be ignored
  await expect(page.getByRole("button", { name: "All (3)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmed (0)" })).toHaveAttribute("aria-pressed", "true");
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
      json: { leads, counts: { all: 1, pending: 0, confirmed: done ? 0 : 1, rescheduled: 0, cancelled: 0, completed: done ? 1 : 0, not_paid: 0 }, total: leads.length, money: { paidThisMonthCents: 0, unpaidCount: 0 } } satisfies LeadList,
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
