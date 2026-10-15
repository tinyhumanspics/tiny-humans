import { expect, test } from "@playwright/test";
import { defaultSettings } from "@/lib/settings/defaults";
import type { LeadList } from "@/lib/leads/types";

const list = (all: number): LeadList => ({
  leads: [],
  counts: { all, pending: 0, confirmed: 0, rescheduled: 0, cancelled: 0 },
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
