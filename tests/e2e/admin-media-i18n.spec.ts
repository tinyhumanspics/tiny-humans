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
  // nothing in "Little moments" was changed: the built-in sections (with their reviewed Spanish wording) stay in use
  expect(parsed.media.default?.sections).toBeNull();
});

test("the owner can save Spanish photo details and box wording, or have it filled in", async ({ page }, testInfo) => {
  const visualCapture = process.env.CAPTURE_MEDIA_I18N === "1";
  test.skip(visualCapture ? testInfo.project.name === "android-chrome" : testInfo.project.name !== "desktop-chrome", "The owner form only needs desktop regression coverage; visual QA also captures iPhone");
  const initial = parseSettings(defaultSettings);
  let saved: SiteSettings = initial;
  const translated: string[][] = [];

  await page.route("**/api/admin/session", (route) => route.fulfill({ json: { authenticated: true, authConfigured: true, storageConfigured: true } }));
  await page.route("**/api/admin/settings", async (route) => {
    if (route.request().method() === "PUT") {
      saved = route.request().postDataJSON() as SiteSettings;
      await route.fulfill({ json: { ...saved, updatedAt: "2026-10-09T12:00:00.000Z" } });
      return;
    }
    await route.fulfill({ json: initial });
  });
  // "Fill in Spanish for me" with a fake translator (the real one is lib/i18n/autotranslate.ts)
  await page.route("**/api/admin/translate", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { on: true } });
    const { texts } = route.request().postDataJSON() as { texts: string[] };
    translated.push(texts);
    return route.fulfill({ json: { on: true, spanish: texts.map((t) => (t ? `ES: ${t}` : "")) } });
  });

  await page.goto("/admin/photos");
  await expect(page.getByRole("heading", { name: "Pictures by website section" })).toBeVisible();
  await expect(page.getByText(/Spanish fills itself in/)).toBeVisible();

  await page.locator("summary", { hasText: "Title Pictures" }).click();
  await page.getByRole("button", { name: "Edit Title Pictures Image 1" }).click();
  const photo = page.locator("dialog[open]");
  // Built-in placeholders carry complete Spanish metadata; clear one field to exercise the partial-draft guard.
  await photo.getByLabel("Description for screen readers (Spanish)", { exact: true }).fill("");
  await photo.getByLabel("Title (Spanish)", { exact: true }).fill("Recién nacido dormido");
  await expect(photo.getByText(/Fill in the Spanish title and description/)).toBeVisible();
  await expect(photo.getByRole("button", { name: "Save words" })).toBeDisabled();
  await photo.getByLabel("Description for screen readers (Spanish)", { exact: true }).fill("Recién nacido dormido envuelto suavemente");
  if (visualCapture) await page.screenshot({ path: `.screenshots/admin-media-spanish/${testInfo.project.name}-photo.png` });
  await photo.getByRole("button", { name: "Save words" }).click();
  await expect(page.getByText("Details saved. It's live on the website now.")).toBeVisible();
  expect(saved.media.default?.title[0]?.spanish).toEqual({
    title: "Recién nacido dormido",
    alt: "Recién nacido dormido envuelto suavemente",
    caption: "Primera semana",
  });
});
