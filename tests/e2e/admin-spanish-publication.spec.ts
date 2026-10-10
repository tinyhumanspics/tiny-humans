import { expect, test } from "@playwright/test";
import { defaultSettings } from "@/lib/settings/defaults";
import type { SiteSettings, SpanishPublicationStatus } from "@/lib/settings/types";

const session = { authenticated: true, authConfigured: true, storageConfigured: true };

test("the owner can publish and hide Spanish without Vercel", async ({ page }, testInfo) => {
  let settings: SiteSettings = { ...defaultSettings, spanishPublished: false };
  let status: SpanishPublicationStatus = { enabled: false, published: false, issues: [] };

  await page.route("**/api/admin/session", (route) => route.fulfill({ json: session }));
  await page.route("**/api/admin/settings", (route) => route.fulfill({ json: settings }));
  await page.route("**/api/admin/spanish", async (route) => {
    if (route.request().method() === "PUT") {
      const { enabled } = route.request().postDataJSON() as { enabled: boolean };
      settings = { ...settings, spanishPublished: enabled, updatedAt: "2026-10-10T12:00:00.000Z" };
      status = { enabled, published: enabled, issues: [] };
      await route.fulfill({ json: { settings, status } });
      return;
    }
    await route.fulfill({ json: status });
  });

  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Spanish website" })).toBeVisible();
  await expect(page.getByText("Hidden", { exact: true })).toBeVisible();
  await expect(page.getByText("No Vercel setting or redeploy is needed.")).toBeVisible();
  if (process.env.CAPTURE_SPANISH_ADMIN === "1") {
    await page.screenshot({ path: `.screenshots/admin-spanish-publication/${testInfo.project.name}.png`, fullPage: true });
  }

  await page.getByRole("button", { name: "Publish Spanish website" }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  await expect(page.getByText("Spanish website is published.")).toBeVisible();
  expect(settings.spanishPublished).toBe(true);

  await page.getByRole("button", { name: "Hide Spanish website" }).click();
  await expect(page.getByText("Hidden", { exact: true })).toBeVisible();
  await expect(page.getByText("Spanish website is hidden.")).toBeVisible();
  expect(settings.spanishPublished).toBe(false);
});

test("an incomplete Spanish journey cannot be published", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the protected failure state");
  const issues = ["Spanish bundle translations", "Spanish titles and descriptions for uploaded photos"];

  await page.route("**/api/admin/session", (route) => route.fulfill({ json: session }));
  await page.route("**/api/admin/settings", (route) => route.fulfill({ json: defaultSettings }));
  await page.route("**/api/admin/spanish", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 400, json: { error: `Spanish can't be published yet. Complete: ${issues.join("; ")}.` } });
      return;
    }
    await route.fulfill({ json: { enabled: false, published: false, issues } });
  });

  await page.goto("/admin/settings");
  for (const issue of issues) await expect(page.getByText(issue, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publish Spanish website" }).click();
  await expect(page.getByText("Spanish can't be published yet", { exact: false })).toBeVisible();
  await expect(page.getByText("Hidden", { exact: true })).toBeVisible();
});
