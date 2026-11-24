import { expect, test } from "@playwright/test";
import { signedInAdmin } from "./fixtures/admin";

/** The website's footer is for the public pages only: the owner area has none (owner, Nov 24). */
test("no footer in the owner area, signed in or not; the website keeps it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await page.goto("/admin");
  await expect(page.locator("#admin-password")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toHaveCount(0);

  await signedInAdmin(page);
  for (const path of ["/admin", "/admin/shoots/poses"]) {
    await page.goto(path);
    await expect(page.getByRole("navigation", { name: "Owner area" })).toBeVisible();
    await expect(page.getByRole("contentinfo"), path).toHaveCount(0);
  }

  await page.goto("/bundles");
  await expect(page.getByRole("contentinfo")).toBeVisible();
});
