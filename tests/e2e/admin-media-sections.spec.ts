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
  // each part of the page is folded to one line (owner, Nov 11): open "Little moments"
  await page.locator("summary", { hasText: "Little Moments Sections" }).click();
  await expect(page.getByRole("heading", { name: "Little Moments Sections" })).toBeVisible();
  return state;
}

const section = (page: Page, n: number) => page.getByRole("region", { name: new RegExp(`^Section ${n}\\b`) });
const saved = (page: Page, text: string) => expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
const dialog = (page: Page) => page.locator("dialog[open]");
/** A picture's card (its tags) and its Edit dialog. */
const card = (page: Page, label: string) => page.getByRole("button", { name: `Edit ${label}` }).locator("xpath=..");
async function editPicture(page: Page, label: string) {
  await page.getByRole("button", { name: `Edit ${label}` }).click();
  await expect(dialog(page)).toBeVisible();
  return dialog(page);
}
async function closeDialog(page: Page) {
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
}

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

  // the box needs its English wording only: an empty Spanish side is filled in when the settings are saved
  await section(page, 4).getByRole("button", { name: "Edit section 4 box" }).click();
  const box = dialog(page);
  await box.getByLabel("Show the box after this section's pictures").check();
  await box.getByLabel("Section 4: box title", { exact: true }).fill("Love the tiny details?");
  await expect(box.getByText("Write the title and the text to show the box.")).toBeVisible();
  await expect(box.getByRole("button", { name: "Save box" })).toBeDisabled();
  await box.getByLabel("Section 4: box text", { exact: true }).fill("Every little finger and toe.");
  await box.getByRole("button", { name: "Save box" }).click();
  await saved(page, "Section 4: box saved.");
  await expect(dialog(page)).toHaveCount(0);
  expect(sections()[3]).toMatchObject({ prompt: true, title: "Love the tiny details?", text: "Every little finger and toe.", spanish: null });
  await expect(section(page, 4).getByText("Box: on · “Love the tiny details?”")).toBeVisible();

  // the box shows the middle picture (here the 2nd) until another one is picked
  await expect(section(page, 4).getByText("★ In the box", { exact: true })).toHaveCount(1);
  let edit = await editPicture(page, "Section 4 Image 1");
  await edit.getByRole("button", { name: "Use this picture in the box" }).click();
  await saved(page, "Section 4: the box now shows Image 1.");
  expect(sections()[3].promptPhotoId).toBe(first.id);
  await closeDialog(page);

  // the tags show what the ad page shows: nothing picked = the first 6 pictures that aren't title photos
  const automatic = ["tiny-toes", "basket-nap", "mom-and-dad", "sleepy-sunday", "tummy-time", "cloud-wrap"];
  await expect(card(page, "Section 1 Image 1").getByText("On the ad page")).toHaveCount(0);
  await expect(card(page, "Section 1 Image 2").getByText("On the ad page")).toHaveCount(1);
  edit = await editPicture(page, "Section 4 Image 2");
  await expect(edit.getByLabel("Section 4 Image 2: on the ad page")).toBeDisabled();
  await closeDialog(page);
  // the first change starts from the pictures showing now
  edit = await editPicture(page, "Section 1 Image 2");
  await expect(edit.getByText("Show on the ad page (picked automatically)")).toBeVisible();
  await edit.getByLabel("Section 1 Image 2: on the ad page").click();
  await saved(page, "Image 2 taken off the ad page.");
  expect(state.saved.media.default!.landingPicks).toEqual(automatic.slice(1));
  await closeDialog(page);
  edit = await editPicture(page, "Section 4 Image 2");
  await edit.getByLabel("Section 4 Image 2: on the ad page").click();
  await saved(page, "Image 2 added to the ad page.");
  expect(state.saved.media.default!.landingPicks).toEqual([...automatic.slice(1), second.id]);

  // moving keeps the box picture and the ad page pick with their pictures
  await edit.getByRole("button", { name: "Move section 4 Image 2 earlier" }).click();
  await saved(page, "Section 4 · Image 2 moved.");
  expect(sections()[3].photos.map((p) => p.id)).toEqual([second.id, first.id]);
  await closeDialog(page);
  await page.getByRole("button", { name: "Move section 4 up" }).click();
  await saved(page, "Section 4 moved up.");
  expect(sections()[2]).toMatchObject({ title: "Love the tiny details?", promptPhotoId: first.id });
  expect(state.saved.media.default!.landingPicks).toEqual([...automatic.slice(1), second.id]);

  // switching a box off keeps its wording for later
  await section(page, 1).getByRole("button", { name: "Edit section 1 box" }).click();
  await dialog(page).getByLabel("Show the box after this section's pictures").uncheck();
  await dialog(page).getByRole("button", { name: "Save box" }).click();
  await saved(page, "Section 1: the box is switched off.");
  expect(sections()[0]).toMatchObject({ prompt: false, title: "Love this one?" });
  await expect(section(page, 1).getByText("Box: off for this section")).toBeVisible();

  await section(page, 3).getByRole("button", { name: "Delete section 3" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Its 2 pictures and its box disappear from the website.");
  await confirm.getByRole("button", { name: "Delete section" }).click();
  await saved(page, "Section 3 · “Love the tiny details?” deleted.");
  expect(sections()).toHaveLength(3);
  expect(state.saved.media.default!.landingPicks).toEqual(automatic.slice(1));

  await page.getByRole("button", { name: "Go back to the first 6 automatically" }).click();
  await saved(page, "The ad page shows the first 6 pictures automatically again.");
  expect(state.saved.media.default!.landingPicks).toEqual([]);
  await expect(card(page, "Section 1 Image 2").getByText("On the ad page")).toHaveCount(1);
});

test("one switch hides every box on the home page and keeps their wording (owner, Nov 11)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "The owner form only needs desktop regression coverage");
  const state = await photosPage(page);
  await expect(page.getByText("3 sections · 9 pictures · 3 boxes showing")).toBeVisible();
  await page.getByLabel("Show the “Book a memory like this one” boxes on the home page").click();
  await saved(page, "The boxes are hidden on the home page.");
  expect(state.saved.portfolioBoxes).toBe(false);
  // the sections themselves are untouched
  expect(state.saved.media.default?.sections ?? null).toBeNull();
  await expect(page.getByText(/Off: no box shows on the home page/)).toBeVisible();
  await expect(section(page, 1).getByText(/hidden: the boxes are switched off above/)).toBeVisible();
  await expect(page.getByText("3 sections · 9 pictures · boxes switched off")).toBeVisible();
  await page.getByLabel("Show the “Book a memory like this one” boxes on the home page").click();
  await saved(page, "The boxes show on the home page again");
  expect(state.saved.portfolioBoxes).toBe(true);
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
