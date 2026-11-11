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

  await page.locator("summary", { hasText: "Little Moments Sections" }).click();
  await page.getByRole("button", { name: "Edit section 1 box" }).click();
  const box = page.locator("dialog[open]");
  await box.getByLabel("Section 1: Spanish box title").fill("¿Enmarcarías esta foto?");
  await box.getByLabel("Section 1: Spanish box text").fill("Guarda un recuerdo así de tu bebé.");
  if (visualCapture) await page.screenshot({ path: `.screenshots/admin-media-spanish/${testInfo.project.name}-prompt.png` });
  await box.getByRole("button", { name: "Save box" }).click();
  await expect(page.getByText("Section 1: box saved. It's live on the website now.")).toBeVisible();
  expect(saved.media.default?.sections?.[0].spanish).toEqual({
    title: "¿Enmarcarías esta foto?",
    text: "Guarda un recuerdo así de tu bebé.",
  });

  // the button translates the English and puts it in the form before saving
  await page.getByRole("button", { name: "Edit section 2 box" }).click();
  const box2 = page.locator("dialog[open]");
  await box2.getByRole("button", { name: "Fill in Spanish for me" }).click();
  await expect(box2.getByLabel("Section 2: Spanish box title")).toHaveValue(/^ES: /);
  await box2.getByRole("button", { name: "Save box" }).click();
  await expect(page.getByText("Section 2: box saved.", { exact: false })).toBeVisible();
  expect(translated.at(-1)).toEqual([saved.media.default!.sections![1].title, saved.media.default!.sections![1].text]);
  expect(saved.media.default!.sections![1].spanish).toEqual({ title: `ES: ${saved.media.default!.sections![1].title}`, text: `ES: ${saved.media.default!.sections![1].text}` });
});
