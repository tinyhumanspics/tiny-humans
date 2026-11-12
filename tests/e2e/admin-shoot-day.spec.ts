import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { inspoKey } from "@/lib/shoots/ticks";
import type { DaySheet, InspoItem, ShootDetail } from "@/lib/shoots/types";
import { signedInAdmin } from "./fixtures/admin";

/** /admin → Shoots, slices 4 + 5: photo uploads in a folder, the day sheet (ticks on both phones, lightbox). APIs faked. */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const DATE = "2026-11-16";
const KEY = "b-TH-20261103-4821";
// a real 1×1 JPEG, so the browser's resize step can open it
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
// a 3×4 cream picture as the uploaded photo's address (no network needed)
const PHOTO_SRC = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#efe3cc"/></svg>');

const item = (over: Partial<InspoItem>): InspoItem => ({ id: "11111111-1111-4111-8111-111111111111", group: "inspo", type: "note", mediaUrl: null, contentType: null, width: null, height: null, linkUrl: null, platform: null, caption: "", who: [], sort: 0, ...over });
const PHOTO1 = item({ id: "aaaaaaaa-1111-4111-8111-111111111111", type: "image", mediaUrl: PHOTO_SRC, caption: "Basket nap, sleepy curl" });
const PHOTO2 = item({ id: "bbbbbbbb-1111-4111-8111-111111111111", type: "image", mediaUrl: PHOTO_SRC, caption: "Toes close-up", sort: 1 });
const IDEA = item({ id: "cccccccc-1111-4111-8111-111111111111", group: "bts", caption: "Camera-back reveal" });

const morales: ShootDetail = {
  key: KEY, id: "0b6f5a3e-1111-4222-8333-944455556666", kind: "booking", date: DATE, start: "09:00", end: "11:00",
  title: "The Morales family", tabLabel: "Morales", bundleLine: "Our Little Story · 2 h · 2 backdrops", bundleName: "Our Little Story",
  place: "Miami Beach", inspoCount: 2, btsCount: 1, status: "confirmed",
  booking: {
    bookingId: "0b6f5a3e-1111-4222-8333-944455556666", reference: "TH-20261103-4821", status: "confirmed", date: DATE, start: "09:00", end: "11:00",
    durationMinutes: 120, parentName: "Maria Morales", defaultTitle: "The Morales family", defaultTabLabel: "Morales", bundleName: "Our Little Story",
    backdropsAllowed: 2, people: "Baby only", siblings: false, babies: [{ name: "Sofia", age: "Newborn (0–2 weeks)", gender: null }], family: [],
    backdrops: [{ id: "cream", name: "Cream", color: "#efe3cc" }], addons: [], pick: null, notes: null,
    address: "1500 Bay Rd, Miami Beach, FL 33139", city: "Miami Beach", mapUrl: "https://www.google.com/maps/search/?api=1&query=1500%20Bay%20Rd", deposit: null,
  },
  inspoTitle: "Inspo for Sofia", whoLine: "Sofia, newborn (0–2 weeks)", said: "Sofia sleeps best right after her 9:00 feed.", saidFromBooking: true,
  confirm: ["Leo (4) in a few?"], autoConfirm: ["Backdrops: 1 of 2 picked. The family picks the rest on their backdrop page."], bringExtra: ["Small stool for Leo"],
  inspo: [PHOTO1, PHOTO2, IDEA],
};

const SHEET: DaySheet = {
  date: DATE,
  sunset: "17:31",
  shoots: [morales],
  bring: {
    backdrops: [{ key: "bring:2026-11-16:bd:b-TH-20261103-4821:cream", text: "Cream backdrop", who: "Morales", color: "#efe3cc" }],
    extras: [{ key: "bring:2026-11-16:b-TH-20261103-4821:1abc", text: "Small stool for Leo", who: "Morales" }],
    sections: [{ id: "11111111-2222-4333-8444-555555555555", name: "Studio kit", items: [{ key: "bring:2026-11-16:11111111-2222-4333-8444-555555555555:9xyz", text: "Space heater" }] }],
  },
  ticks: [],
  ticked: 0,
  total: 6,
};

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area (phone size set per test)");
  await signedInAdmin(page);
});

/** The day sheet API with a server-side tick list; `fail` makes the next tick POSTs fail. */
async function fakeDay(page: Page) {
  const state = { ticks: new Set<string>(), posts: [] as { key: string; on: boolean }[], fail: 0, cleared: 0, gets: 0 };
  await page.route(`**/api/admin/shoots/day/${DATE}`, (route) => {
    state.gets += 1;
    return route.fulfill({ json: { day: { ...SHEET, ticks: [...state.ticks] } } });
  });
  await page.route("**/api/admin/shoots/ticks", (route) => {
    const body = route.request().postDataJSON() as { key: string; on: boolean };
    if (state.fail > 0) {
      state.fail -= 1;
      return route.fulfill({ status: 500, json: { error: "Couldn't save that." } });
    }
    state.posts.push({ key: body.key, on: body.on });
    if (body.on) state.ticks.add(body.key);
    else state.ticks.delete(body.key);
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/admin/shoots/ticks?*", (route) => {
    state.cleared += 1;
    state.ticks.clear();
    return route.fulfill({ status: 204 });
  });
  return state;
}

test("the day sheet: header, who's on camera, still to confirm, the family, inspo + BTS, What to bring", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeDay(page);
  await page.goto(`/admin/shoots/${DATE}`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Monday, November 16");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByText("1 shoot · Miami Beach")).toBeVisible();
  await expect(page.getByText("2 inspo · 1 BTS ideas · sunset 5:31")).toBeVisible();
  await expect(page.getByText("0 of 6 ticked")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Jump to" }).getByRole("button")).toHaveText(["Morales", "What to bring"]);
  await expect(page.getByRole("region", { name: "Who's on camera" })).toContainText("Morales: Sofia, newborn (0–2 weeks). 9:00, Miami Beach.");
  const confirm = page.getByRole("region", { name: "Still to confirm" });
  await expect(confirm).toContainText("Backdrops: 1 of 2 picked.");
  await expect(confirm).toContainText("Leo (4) in a few?");

  const family = page.getByRole("region", { name: "The Morales family" });
  await expect(family).toContainText("Shoot 1 · 9:00 to 11:00");
  await expect(family.getByRole("link", { name: /Map/ })).toHaveAttribute("href", morales.booking!.mapUrl);
  await expect(family).toContainText("Sofia sleeps best right after her 9:00 feed.");
  await expect(family.getByRole("heading", { name: "Inspo for Sofia 0/2" })).toBeVisible();
  await expect(family.getByRole("heading", { name: "BTS on phones 0/1" })).toBeVisible();
  await expect(family.getByRole("link", { name: "Open the Morales folder →" })).toHaveAttribute("href", `/admin/shoots/folder/${KEY}`);

  const bring = page.getByRole("region", { name: "What to bring" });
  await expect(bring.getByRole("checkbox")).toHaveCount(3);
  await expect(bring).toContainText("Cream backdrop (Morales)");
  await expect(bring).toContainText("Small stool for Leo (Morales)");

  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);
});

test("ticks: instant on screen, saved, kept through a failed send, and the other phone's ticks show up", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await fakeDay(page);
  await page.clock.install();
  await page.goto(`/admin/shoots/${DATE}`);
  const family = page.getByRole("region", { name: "The Morales family" });

  await family.getByRole("button", { name: "Done: Basket nap, sleepy curl" }).click();
  await expect(family.getByRole("button", { name: "Done: Basket nap, sleepy curl" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => state.posts).toEqual([{ key: inspoKey(PHOTO1.id), on: true }]);
  await expect(page.getByText("1 of 6 ticked")).toBeVisible();
  await expect(family.getByRole("heading", { name: "Inspo for Sofia 1/2" })).toBeVisible();

  // the connection drops: the tick stays and is retried
  state.fail = 1;
  await page.getByRole("region", { name: "What to bring" }).getByLabel("Space heater").check();
  await expect(page.getByText("Not saved yet, retrying…")).toBeVisible();
  await expect(page.getByRole("region", { name: "What to bring" }).getByLabel("Space heater")).toBeChecked();
  await page.clock.fastForward(4500);
  await expect(page.getByText("Not saved yet, retrying…")).toHaveCount(0);
  expect(state.posts.at(-1)).toEqual({ key: SHEET.bring.sections[0].items[0].key, on: true });

  // Alo ticks the BTS idea on her phone: it shows up here at the next check (~10 s)
  state.ticks.add(inspoKey(IDEA.id));
  await page.clock.fastForward(10_500);
  await expect(family.getByRole("button", { name: "Done: Camera-back reveal" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("3 of 6 ticked")).toBeVisible();
});

test("lightbox: tap a photo, next, Mark as done, Escape; Clear all ticks takes two taps", async ({ page }) => {
  const state = await fakeDay(page);
  await page.goto(`/admin/shoots/${DATE}`);
  const family = page.getByRole("region", { name: "The Morales family" });
  const opener = family.getByRole("button", { name: "See Basket nap, sleepy curl big" });
  await opener.click();
  const box = page.getByRole("dialog");
  await expect(box).toBeVisible();
  await expect(box).toContainText("1 of 2");
  await expect(box).toContainText("Basket nap, sleepy curl");
  await box.getByRole("button", { name: "Next →" }).click();
  await expect(box).toContainText("Toes close-up");
  await box.getByRole("button", { name: "Mark as done" }).click();
  await expect(box.getByRole("button", { name: "Done ✓" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => state.posts).toEqual([{ key: inspoKey(PHOTO2.id), on: true }]);
  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(family.getByRole("button", { name: "Done: Toes close-up" })).toHaveAttribute("aria-pressed", "true");

  const clear = page.getByRole("button", { name: "Clear all ticks" });
  await clear.click();
  expect(state.cleared).toBe(0);
  await page.getByRole("button", { name: "Tap again to clear every tick" }).click();
  await expect.poll(() => state.cleared).toBe(1);
  await expect(page.getByText("0 of 6 ticked")).toBeVisible();
});

test("videos play inside the sheet: Instagram, a TikTok short link, one that can't play; Mark as done; Escape", async ({ page }) => {
  const REEL = item({ id: "eeeeeeee-1111-4111-8111-111111111111", type: "link", linkUrl: "https://www.instagram.com/reel/DLHx_WNoXoY/?igsh=abc", platform: "Instagram", caption: "Sleepy reel", sort: 1 });
  const SHORT = item({ id: "ffffffff-1111-4111-8111-111111111111", type: "link", linkUrl: "https://vm.tiktok.com/ZMh1abcDE/", platform: "TikTok", caption: "Swaddle twirl", sort: 2 });
  const GONE = item({ id: "abababab-1111-4111-8111-111111111111", type: "link", linkUrl: "https://vm.tiktok.com/ZMgone/", platform: "TikTok", caption: "Old one", sort: 3 });
  const PIN = item({ id: "cdcdcdcd-1111-4111-8111-111111111111", type: "link", linkUrl: "https://www.pinterest.com/pin/99360735500167749/", platform: "Pinterest", caption: "Pin idea", sort: 4 });
  const shoot = { ...morales, inspo: [PHOTO1, REEL, SHORT, GONE, PIN, IDEA], inspoCount: 5 };
  const state = await fakeDay(page);
  await page.unroute(`**/api/admin/shoots/day/${DATE}`);
  await page.route(`**/api/admin/shoots/day/${DATE}`, (route) => route.fulfill({ json: { day: { ...SHEET, shoots: [shoot], ticks: [...state.ticks] } } }));
  // the apps' players are answered here: a test never reaches Instagram or TikTok
  const players: string[] = [];
  await page.route(/^https:\/\/www\.(instagram|tiktok|youtube-nocookie)\.com\//, (route) => {
    players.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><title>Player</title><p>Player</p></html>' });
  });
  // cover pictures come from our own route (Instagram's picture server refuses other sites)
  const covers: string[] = [];
  await page.route("**/api/admin/shoots/cover?*", (route) => {
    const link = new URL(route.request().url()).searchParams.get("link")!;
    covers.push(link);
    return link.includes("instagram.com")
      ? route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64") })
      : route.fulfill({ status: 404 });
  });
  const asked: string[] = [];
  await page.route("**/api/admin/shoots/player?*", (route) => {
    const link = new URL(route.request().url()).searchParams.get("link")!;
    asked.push(link);
    return route.fulfill({ json: { player: link.includes("gone") ? null : { src: "https://www.tiktok.com/player/v1/7301234567890123456?rel=0", shape: "tall" } } });
  });
  await page.goto(`/admin/shoots/${DATE}`);
  const family = page.getByRole("region", { name: "The Morales family" });
  await expect(family).toContainText("Tap a photo to see it big, or a video to play it here.");
  // nothing loads from the apps until a video is tapped; a Pinterest pin still opens the link
  await expect(family.getByRole("link", { name: /Pinterest/ })).toHaveAttribute("href", PIN.linkUrl!);
  expect(players).toEqual([]);
  // the Reel's card shows its cover picture; TikTok gives none, so its cards don't ask
  const reelCover = family.getByRole("button", { name: "Instagram Play here (Sleepy reel)" }).locator("img");
  await expect(reelCover).toBeVisible();
  await expect.poll(() => reelCover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect(covers).toEqual([REEL.linkUrl]);
  await expect(family.getByRole("button", { name: "TikTok Play here (Swaddle twirl)" }).locator("img")).toHaveCount(0);
  // photos on their own rows, then videos, then ideas and links (never mixed)
  await expect(family.getByText(/^(Photos|Videos|Ideas and links)$/)).toHaveText(["Photos", "Videos", "Ideas and links"]);
  const rows = family.getByRole("list").filter({ has: page.getByRole("button", { name: /^(See |\w+ Play here)/ }) });
  await expect(rows.nth(0).getByRole("listitem")).toHaveCount(1);
  await expect(rows.nth(0).getByRole("button", { name: "See Basket nap, sleepy curl big" })).toBeVisible();
  await expect(rows.nth(1).getByRole("listitem")).toHaveCount(3);

  const opener = family.getByRole("button", { name: "Instagram Play here (Sleepy reel)" });
  await opener.click();
  const box = page.getByRole("dialog");
  await expect(box).toHaveAccessibleName("Sleepy reel");
  await expect(box).toContainText("2 of 4");
  const reel = box.frameLocator("iframe[title='Instagram video: Sleepy reel']");
  await expect(reel.getByText("Player")).toBeVisible();
  expect(players).toEqual(["https://www.instagram.com/reel/DLHx_WNoXoY/embed/"]);
  const open = box.getByRole("link", { name: "Open in Instagram ↗ (opens a new tab)" });
  await expect(open).toHaveAttribute("href", REEL.linkUrl!);
  await expect(open).toHaveAttribute("target", "_blank");
  await box.getByRole("button", { name: "Mark as done" }).click();
  await expect.poll(() => state.posts).toEqual([{ key: inspoKey(REEL.id), on: true }]);

  // a short TikTok link: the server finds the video first
  await box.getByRole("button", { name: "Next →" }).click();
  await expect(box.locator("iframe[title='TikTok video: Swaddle twirl']")).toHaveAttribute("src", "https://www.tiktok.com/player/v1/7301234567890123456?rel=0");
  expect(asked).toEqual([SHORT.linkUrl]);
  await box.getByRole("button", { name: "Next →" }).click();
  await expect(box).toContainText("This video can't play here. It may be private or removed.");
  await expect(box.getByRole("link", { name: "Open in TikTok ↗ (opens a new tab)" }).first()).toHaveAttribute("href", GONE.linkUrl!);
  await expect(box.locator("iframe")).toHaveCount(0);
  await box.getByRole("button", { name: "Next →" }).click();
  await expect(box.getByRole("img", { name: "Basket nap, sleepy curl" })).toBeVisible();

  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(family.getByRole("button", { name: "Done: Sleepy reel" })).toHaveAttribute("aria-pressed", "true");
});

test("folder: drop photos (shrunk, uploaded one by one), a video is turned away, tap a photo to see it big", async ({ page }) => {
  const folder: ShootDetail = { ...morales, inspo: [] };
  const uploads: { group: string; type: string; width: string }[] = [];
  let n = 0;
  await page.route(`**/api/admin/shoots/${KEY}`, (route) => route.fulfill({ json: { shoot: folder } }));
  await page.route(`**/api/admin/shoots/${KEY}/inspo/photo`, async (route) => {
    const body = route.request().postDataBuffer()!.toString("latin1");
    uploads.push({ group: /name="group"\r\n\r\n(\w+)/.exec(body)![1], type: /Content-Type: (image\/\w+)/.exec(body)![1], width: /name="width"\r\n\r\n(\d+)/.exec(body)![1] });
    n += 1;
    return route.fulfill({ status: 201, json: { item: item({ id: `dddddddd-1111-4111-8111-11111111111${n}`, type: "image", mediaUrl: PHOTO_SRC }) } });
  });
  await page.goto(`/admin/shoots/folder/${KEY}`);
  const inspo = page.getByRole("region", { name: "Inspo for Sofia" });
  await inspo.locator('input[type="file"]').setInputFiles([
    { name: "a.jpg", mimeType: "image/jpeg", buffer: JPEG },
    { name: "b.jpg", mimeType: "image/jpeg", buffer: JPEG },
    { name: "clip.mov", mimeType: "video/quicktime", buffer: Buffer.from("not really a video") },
  ]);
  await expect(inspo.getByText("2 photos added. Write what each one is below. Videos aren't uploaded here: paste the link instead.")).toBeVisible();
  expect(uploads).toEqual([
    { group: "inspo", type: "image/jpeg", width: "1" },
    { group: "inspo", type: "image/jpeg", width: "1" },
  ]);
  await expect(inspo.getByLabel("What's the shot?")).toHaveCount(2);
  await inspo.getByRole("button", { name: "See this photo big" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("1 of 2");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
