import { expect, test } from "@playwright/test";
import { emptyThemeMedia } from "@/config/media";
import { defaultSettings, parseSettings } from "@/lib/settings/defaults";
import type { SiteSettings } from "@/lib/settings/types";

/** Owner, Nov 16: /admin → Photos copies one theme's pictures into another (Thanksgiving's on Christmas for now). */
test("Photos: copy every picture from one theme into another, after a confirm", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser is enough for the owner area.");
  const top = { id: "top-1", src: "/portfolio/tiny-toes.jpg", width: 1200, height: 800, title: "Tiny toes", alt: "Tiny toes", caption: "", spanish: null };
  const thanksgiving = { ...emptyThemeMedia(), landing: [null, null, top] };
  let saved: SiteSettings = { ...(parseSettings(defaultSettings) as SiteSettings), themeId: "thanksgiving" };
  saved = { ...saved, media: { ...saved.media, thanksgiving } };
  await page.route("**/api/admin/session", (route) => route.fulfill({ json: { authenticated: true, authConfigured: true, storageConfigured: true } }));
  await page.route("**/api/admin/settings", async (route) => {
    if (route.request().method() === "PUT") saved = { ...(route.request().postDataJSON() as SiteSettings), updatedAt: "2026-11-16T12:00:00.000Z" };
    await route.fulfill({ json: saved });
  });
  await page.goto("/admin/photos");
  await page.getByRole("button", { name: "Christmas", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copy into Christmas" })).toBeDisabled();
  await page.getByLabel("Copy all pictures from").selectOption({ label: "Thanksgiving" });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Copy into Christmas" }).click();
  await expect(page.getByText("Christmas now has all of Thanksgiving's pictures.")).toBeVisible();
  expect(saved.media.christmas?.landing[2]?.id).toBe("top-1");
  expect(saved.media.thanksgiving?.landing[2]?.id).toBe("top-1");
});
