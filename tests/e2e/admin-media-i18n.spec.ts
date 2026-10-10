import { expect, test } from "@playwright/test";
import { defaultSettings, parseSettings } from "@/lib/settings/defaults";
import type { SiteSettings } from "@/lib/settings/types";

test("older photo settings safely have no Spanish drafts", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Settings parsing only needs one Node project");
  const parsed = parseSettings({
    ...defaultSettings,
    media: {
      default: {
        title: [{ id: "photo-1", src: "/portfolio/tiny-toes.jpg", width: 1200, height: 800, title: "Tiny toes", alt: "Tiny toes" }],
      },
    },
  });
  expect(parsed.media.default?.title[0]?.spanish).toBeNull();
  expect(parsed.media.default?.groups.every((group) => group.spanish === null)).toBe(true);
});

test("the owner can save Spanish photo details and prompt copy", async ({ page }, testInfo) => {
  const visualCapture = process.env.CAPTURE_MEDIA_I18N === "1";
  test.skip(visualCapture ? testInfo.project.name === "android-chrome" : testInfo.project.name !== "desktop-chrome", "The owner form only needs desktop regression coverage; visual QA also captures iPhone");
  const initial = parseSettings(defaultSettings);
  let saved: SiteSettings = initial;

  await page.route("**/api/admin/session", (route) => route.fulfill({ json: { authenticated: true, authConfigured: true, storageConfigured: true } }));
  await page.route("**/api/admin/settings", async (route) => {
    if (route.request().method() === "PUT") {
      saved = route.request().postDataJSON() as SiteSettings;
      await route.fulfill({ json: { ...saved, updatedAt: "2026-10-09T12:00:00.000Z" } });
      return;
    }
    await route.fulfill({ json: initial });
  });

  await page.goto("/admin/photos");
  await expect(page.getByRole("heading", { name: "Pictures by website section" })).toBeVisible();

  await page.getByRole("button", { name: "Details", exact: true }).first().click();
  await page.getByLabel("Photo title (Spanish)", { exact: true }).fill("Recién nacido dormido");
  await expect(page.getByText(/Complete the Spanish title and description/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save details" }).first()).toBeDisabled();
  await page.getByLabel("Description for screen readers (Spanish)", { exact: true }).fill("Recién nacido dormido envuelto suavemente");
  if (visualCapture) await page.screenshot({ path: `.screenshots/admin-media-spanish/${testInfo.project.name}-photo.png` });
  await page.getByRole("button", { name: "Save details" }).first().click();
  await expect(page.getByText("Details saved. It's live on the website now.")).toBeVisible();
  expect(saved.media.default?.title[0]?.spanish).toEqual({
    title: "Recién nacido dormido",
    alt: "Recién nacido dormido envuelto suavemente",
  });

  const firstPrompt = "Love This One Pictures";
  await page.getByLabel(`${firstPrompt}: Spanish prompt title`).fill("¿Enmarcarías esta foto?");
  await page.getByLabel(`${firstPrompt}: Spanish prompt text`).fill("Guarda un recuerdo así de tu bebé.");
  await page.getByLabel(`${firstPrompt}: Spanish prompt title`).scrollIntoViewIfNeeded();
  if (visualCapture) await page.screenshot({ path: `.screenshots/admin-media-spanish/${testInfo.project.name}-prompt.png` });
  await page.getByRole("button", { name: "Save prompt" }).first().click();
  await expect(page.getByText("Prompt text saved. It's live on the website now.")).toBeVisible();
  expect(saved.media.default?.groups[0].spanish).toEqual({
    title: "¿Enmarcarías esta foto?",
    text: "Guarda un recuerdo así de tu bebé.",
  });
});
