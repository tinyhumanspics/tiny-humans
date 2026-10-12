import { expect, test } from "@playwright/test";

// The isolated test build has no database, so this is the state before migration 0020 runs (and the fallback if Neon
// is down). The full Face ID flow needs a database: see PROGRESS (local DB + Chromium virtual authenticator).
const PASSWORD = process.env.ADMIN_PASSWORD ?? "playwright-local-password";

test("without the passkey migration, owner sign-in stays password-only and explains the update", async ({ page, request, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "WebKit drops the Secure owner cookie on http://localhost.");
  expect(await (await request.get("/api/admin/passkeys/available")).json()).toEqual({ available: false });

  await page.goto("/admin");
  await expect(page.locator("#admin-password")).toBeVisible();
  await expect(page.getByRole("button", { name: /Face ID/ })).toHaveCount(0);
  await page.fill("#admin-password", PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Sign-in" })).toBeVisible();
  await expect(page.getByText(/needs a one-time database update \(migration 0020\)/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out all other devices" })).toBeDisabled();

  const origin = new URL(baseURL!).origin;
  const others = await page.request.post("/api/admin/session/others", { headers: { origin } });
  expect(others.status()).toBe(503);
  const options = await page.request.post("/api/admin/passkeys/login/options", { headers: { origin } });
  expect(options.status()).toBe(404);
});
