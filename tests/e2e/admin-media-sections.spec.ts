import { expect, test, type Page } from "@playwright/test";
import { BUILT_IN, MEDIA_GROUPS } from "@/config/media";
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
  // each part of the page is folded to one line: open "Little Moments"
  await page.locator("summary").filter({ has: page.getByRole("heading", { name: "Little Moments", exact: true }) }).click();
  return state;
}

const saved = (page: Page, text: string) => expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
const dialog = (page: Page) => page.locator("dialog[open]");
/** A picture's card (its tags) and its Edit dialog. */
const card = (page: Page, n: number) => page.getByRole("button", { name: `Edit Little Moments Image ${n}`, exact: true }).locator("xpath=..");
async function editPicture(page: Page, n: number) {
  await page.getByRole("button", { name: `Edit Little Moments Image ${n}`, exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  return dialog(page);
}
async function closeDialog(page: Page) {
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
}

test("Little Moments is one list: add, order and remove pictures; no sections or boxes (owner, Nov 11)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "The owner form only needs desktop regression coverage");
  const state = await photosPage(page);
  const builtIn = BUILT_IN.sections.flatMap((s) => s.photos);
  const photos = () => state.saved.media.default!.sections!.flatMap((s) => s.photos);

  // nothing about sections or boxes any more
  await expect(page.getByRole("button", { name: "+ Add a section" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /box/i })).toHaveCount(0);
  await expect(page.getByText("Show the “Book a memory like this one” boxes", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Edit Little Moments Image \d+$/ })).toHaveCount(builtIn.length);

  await page.getByLabel("Add pictures to Little Moments").setInputFiles(["public/portfolio/tiny-toes.jpg", "public/portfolio/first-smile.jpg"]);
  await saved(page, "2 pictures added at the end of the gallery.");
  expect(photos()).toHaveLength(builtIn.length + 2);
  // saved behind the scenes as sections of up to 12 with no box (an older version of the site still reads it)
  expect(state.saved.media.default!.sections!.every((s) => s.photos.length <= MEDIA_GROUPS.sections.maxPhotos && s.prompt === false)).toBe(true);
  const [first, second] = photos().slice(-2);
  expect([first.src, second.src]).toEqual(["/portfolio/tiny-toes.jpg", "/portfolio/first-smile.jpg"]);

  // the tags show what the ad page shows: nothing picked = the first 6 pictures that aren't title photos
  const automatic = ["tiny-toes", "basket-nap", "mom-and-dad", "sleepy-sunday", "tummy-time", "cloud-wrap"];
  await expect(card(page, 1).getByText("On the ad page")).toHaveCount(0);
  await expect(card(page, 2).getByText("On the ad page")).toHaveCount(1);
  let edit = await editPicture(page, 2);
  await expect(edit.getByText("Show on the ad page (picked automatically)")).toBeVisible();
  await edit.getByLabel("Image 2: on the ad page").click();
  await saved(page, "Image 2 taken off the ad page.");
  expect(state.saved.media.default!.landingPicks).toEqual(automatic.slice(1));
  await closeDialog(page);

  // moving and removing keep the ad page picks with their pictures
  const last = builtIn.length + 2;
  edit = await editPicture(page, last);
  await edit.getByRole("button", { name: `Move Image ${last} earlier` }).click();
  await saved(page, `Image ${last} moved.`);
  expect(photos().slice(-2).map((p) => p.id)).toEqual([second.id, first.id]);
  await closeDialog(page);
  edit = await editPicture(page, 1);
  await edit.getByRole("button", { name: "Remove from the gallery" }).click();
  await saved(page, "Image 1 removed.");
  expect(photos()).toHaveLength(builtIn.length + 1);
  expect(photos()[0].id).toBe(builtIn[1].id);

  await page.getByRole("button", { name: "Go back to the first 6 automatically" }).click();
  await saved(page, "The ad page shows the first 6 pictures automatically again.");
  expect(state.saved.media.default!.landingPicks).toEqual([]);
});

test("another theme copies the Original theme's pictures on its first change and can start over", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "The owner form only needs desktop regression coverage");
  const state = await photosPage(page);
  const builtIn = BUILT_IN.sections.flatMap((s) => s.photos);

  await page.getByRole("button", { name: /^Christmas/ }).click();
  await expect(page.getByText("The Christmas theme uses the Original theme's pictures.")).toBeVisible();
  const edit = await editPicture(page, 2);
  await edit.getByRole("button", { name: "Move Image 2 earlier" }).click();
  await saved(page, "The Christmas theme now has its own pictures (the Original theme didn't change).");
  expect(state.saved.media.christmas!.sections!.flatMap((s) => s.photos).slice(0, 2).map((p) => p.id)).toEqual([builtIn[1].id, builtIn[0].id]);
  expect(state.saved.media.default?.sections ?? null).toBeNull();
  await closeDialog(page);

  await page.getByRole("button", { name: "Start over from the Original theme's pictures" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Start over" }).click();
  await saved(page, "The Christmas theme shows the Original theme's pictures again.");
  expect(state.saved.media.christmas!.sections).toBeNull();
  await expect(page.getByText("The Christmas theme uses the Original theme's pictures.")).toBeVisible();
});
