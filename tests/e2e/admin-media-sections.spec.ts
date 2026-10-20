import { expect, test, type Page } from "@playwright/test";
import { defaultSettings, parseSettings } from "@/lib/settings/defaults";
import type { SiteSettings } from "@/lib/settings/types";

/** The owner area with faked owner APIs: every save is kept in `state.saved`, uploads return built-in pictures. */
async function photosPage(page: Page) {
  const state = { saved: parseSettings(defaultSettings) as SiteSettings };
  const uploads = ["/portfolio/tiny-toes.jpg", "/portfolio/first-smile.jpg"];
  await page.route("**/api/admin/session", (route) => route.fulfill({ json: { authenticated: true, authConfigured: true, storageConfigured: true } }));
  await page.route("**/api/admin/photos", (route) => route.fulfill({ json: { src: uploads.shift() ?? "/portfolio/basket-nap.jpg" } }));
  await page.route("**/api/admin/settings", async (route) => {
    if (route.request().method() === "PUT") state.saved = { ...(route.request().postDataJSON() as SiteSettings), updatedAt: "2026-10-19T12:00:00.000Z" };
    await route.fulfill({ json: state.saved });
  });
  await page.goto("/admin/photos");
  await expect(page.getByRole("heading", { name: "Little Moments Sections" })).toBeVisible();
  return state;
}

const section = (page: Page, n: number) => page.getByRole("region", { name: new RegExp(`^Section ${n}\\b`) });
const saved = (page: Page, text: string) => expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();

test("the owner adds, fills, orders and deletes Little moments sections", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "The owner form only needs desktop regression coverage");
  const state = await photosPage(page);
  const sections = () => state.saved.media.default!.sections!;

  await page.getByRole("button", { name: "+ Add a section" }).click();
  await saved(page, "New section added at the bottom.");
  expect(sections()).toHaveLength(4);
  expect(sections()[3]).toMatchObject({ photos: [], prompt: false });

  await page.getByLabel("Add pictures to section 4").setInputFiles(["public/portfolio/tiny-toes.jpg", "public/portfolio/first-smile.jpg"]);
  await saved(page, "2 pictures added to section 4.");
  const [first, second] = sections()[3].photos;
  expect([first.src, second.src]).toEqual(["/portfolio/tiny-toes.jpg", "/portfolio/first-smile.jpg"]);

  // the box needs English and Spanish wording
  const s4 = section(page, 4);
  await s4.getByLabel(/Show the .* box after these pictures/).check();
  await s4.getByLabel("Section 4: box title", { exact: true }).fill("Love the tiny details?");
  await s4.getByLabel("Section 4: box text", { exact: true }).fill("Every little finger and toe.");
  await expect(s4.getByText("Fill in the English and Spanish title and text to show the box.")).toBeVisible();
  await expect(s4.getByRole("button", { name: "Save box" })).toBeDisabled();
  await s4.getByLabel("Section 4: Spanish box title").fill("¿Te encantan los detalles?");
  await s4.getByLabel("Section 4: Spanish box text").fill("Cada dedito.");
  await s4.getByRole("button", { name: "Save box" }).click();
  await saved(page, "Section 4: box saved.");
  expect(sections()[3]).toMatchObject({ prompt: true, title: "Love the tiny details?", text: "Every little finger and toe.", spanish: { title: "¿Te encantan los detalles?", text: "Cada dedito." } });

  // the box shows the middle picture (here the 2nd) until another one is picked
  await expect(section(page, 4).getByText("★ In the box", { exact: true })).toHaveCount(1);
  await section(page, 4).getByRole("button", { name: "Use in the box" }).click();
  await saved(page, "Section 4: the box now shows Image 1.");
  expect(sections()[3].promptPhotoId).toBe(first.id);

  await page.getByLabel("Section 4 Image 2: on landing page").click();
  await saved(page, "Image 2 added to the landing page.");
  expect(state.saved.media.default!.landingPicks).toEqual([second.id]);

  // moving keeps the box picture and the landing pick with their pictures
  await page.getByRole("button", { name: "Move section 4 Image 2 earlier" }).click();
  await saved(page, "Section 4 · Image 2 moved.");
  expect(sections()[3].photos.map((p) => p.id)).toEqual([second.id, first.id]);
  await page.getByRole("button", { name: "Move section 4 up" }).click();
  await saved(page, "Section 4 moved up.");
  expect(sections()[2]).toMatchObject({ title: "Love the tiny details?", promptPhotoId: first.id });
  expect(state.saved.media.default!.landingPicks).toEqual([second.id]);

  // switching a box off keeps its wording for later
  const s1 = section(page, 1);
  await s1.getByLabel(/Show the .* box after these pictures/).uncheck();
  await s1.getByRole("button", { name: "Save box" }).click();
  await saved(page, "Section 1: the box is switched off.");
  expect(sections()[0]).toMatchObject({ prompt: false, title: "Love this one?" });

  await section(page, 3).getByRole("button", { name: "Delete section" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Its 2 pictures and its box disappear from the website.");
  await dialog.getByRole("button", { name: "Delete section" }).click();
  await saved(page, "Section 3 · “Love the tiny details?” deleted.");
  expect(sections()).toHaveLength(3);
  expect(state.saved.media.default!.landingPicks).toEqual([]);
});

test("another theme copies the Original theme's sections on its first change and can start over", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "The owner form only needs desktop regression coverage");
  const state = await photosPage(page);

  await page.getByRole("button", { name: /^Christmas/ }).click();
  await expect(page.getByText("The Christmas theme uses the Original theme's sections.")).toBeVisible();
  await page.getByRole("button", { name: "Move section 2 up" }).click();
  await saved(page, "The Christmas theme now has its own sections (the Original theme didn't change).");
  expect(state.saved.media.christmas!.sections!.map((s) => s.id)).toEqual(["section-2", "section-1", "section-3"]);
  expect(state.saved.media.default?.sections ?? null).toBeNull();

  await page.getByRole("button", { name: "Start over from the Original theme's sections" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Start over" }).click();
  await saved(page, "The Christmas theme shows the Original theme's sections again.");
  expect(state.saved.media.christmas!.sections).toBeNull();
  await expect(page.getByText("The Christmas theme uses the Original theme's sections.")).toBeVisible();
});
