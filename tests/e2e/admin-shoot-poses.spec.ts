import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { poseKey } from "@/lib/shoots/ticks";
import type { DaySheet, ShootDetail, SignaturePose } from "@/lib/shoots/types";
import { signedInAdmin } from "./fixtures/admin";

/** /admin → Shoots → Signature poses (owner, Nov 24): set up once, listed in every folder, ticked per family. APIs faked. */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const DATE = "2026-11-16";
const KEY = "b-TH-20261103-4821";
// a real 1×1 JPEG, so the browser's resize step can open it
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
const PHOTO_SRC = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#efe3cc"/></svg>');

const CHIN: SignaturePose = {
  id: "a1111111-1111-4111-8111-111111111111",
  name: "Chin on hands",
  steps: ["Pillow under the hips", "Rolled towel under the chest"],
  photos: [
    { id: "a1111111-2222-4111-8111-111111111111", url: PHOTO_SRC, width: 300, height: 400 },
    { id: "a1111111-3333-4111-8111-111111111111", url: PHOTO_SRC, width: 300, height: 400 },
  ],
  sort: 0,
};
const TACO: SignaturePose = { id: "b2222222-2222-4222-8222-222222222222", name: "Taco", steps: [], photos: [], sort: 1 };

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area (phone size set per test)");
  await signedInAdmin(page);
});

/** The poses API with a server-side list. */
async function fakePoses(page: Page, start: SignaturePose[] = [CHIN, TACO]) {
  const state = { poses: structuredClone(start), patches: [] as { id: string; body: unknown }[], orders: [] as string[][], deleted: [] as string[], photoDeletes: [] as string[] };
  await page.route("**/api/admin/shoots/poses", (route) => {
    const method = route.request().method();
    if (method === "GET") return route.fulfill({ json: { poses: state.poses } });
    if (method === "POST") {
      const pose: SignaturePose = { id: "c3333333-3333-4333-8333-333333333333", name: "", steps: [], photos: [], sort: state.poses.length };
      state.poses.push(pose);
      return route.fulfill({ status: 201, json: { pose } });
    }
    const { order } = route.request().postDataJSON() as { order: string[] };
    state.orders.push(order);
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/admin/shoots/poses/*", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (route.request().method() === "DELETE") {
      state.deleted.push(id);
      return route.fulfill({ status: 204 });
    }
    state.patches.push({ id, body: route.request().postDataJSON() });
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/admin/shoots/poses/*/photo", (route) =>
    route.fulfill({ status: 201, json: { photo: { id: "b2222222-9999-4222-8222-222222222222", url: PHOTO_SRC, width: 1, height: 1 } } }),
  );
  await page.route("**/api/admin/shoots/poses/*/photo/*", (route) => {
    state.photoDeletes.push(new URL(route.request().url()).pathname.split("/").at(-1)!);
    return route.fulfill({ status: 204 });
  });
  return state;
}

test("Signature poses: name, photos, how to set it up, order and remove", async ({ page }) => {
  const state = await fakePoses(page);
  await page.goto("/admin/shoots/poses");
  await expect(page.getByRole("link", { name: "Signature poses" })).toHaveAttribute("aria-current", "page");
  const chin = page.getByRole("listitem", { name: "Chin on hands" });
  await expect(chin.getByLabel("How to set it up")).toHaveValue("Pillow under the hips\nRolled towel under the chest");
  await expect(chin.getByText("On the shoot list", { exact: true })).toBeVisible();

  // a photo for Taco (tap "+ Add photos" on the phone; drop on a computer)
  const taco = page.getByRole("listitem", { name: "Taco" });
  await taco.locator('input[type="file"]').setInputFiles({ name: "taco.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await expect(taco.getByText("1 photo added.")).toBeVisible();
  await expect(taco.getByRole("button", { name: "See photo 1 of Taco big" })).toBeVisible();

  // how to set it up saves by itself
  await taco.getByLabel("How to set it up").fill("Bean bag tilted up\nHands under the cheek");
  await taco.getByLabel("How to set it up").blur();
  await expect.poll(() => state.patches.at(-1)).toEqual({ id: TACO.id, body: { name: "Taco", steps: "Bean bag tilted up\nHands under the cheek" } });
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // order: Taco first
  await taco.getByRole("button", { name: "← Move earlier (Taco)" }).click();
  await expect.poll(() => state.orders).toEqual([[TACO.id, CHIN.id]]);
  await expect(page.getByRole("listitem").filter({ has: page.getByLabel("Pose name") }).first()).toHaveAttribute("aria-label", "Taco");

  // a photo goes after two taps
  await chin.getByRole("button", { name: "Remove photo 2 of Chin on hands" }).click();
  await chin.getByRole("button", { name: "Tap again photo 2 of Chin on hands" }).click();
  await expect.poll(() => state.photoDeletes).toEqual([CHIN.photos[1].id]);

  // + Add a pose: an empty card with its name ready to type
  await page.getByRole("button", { name: "+ Add a pose" }).click();
  await expect(page.getByLabel("Pose name").last()).toBeFocused();

  // a whole pose goes after two taps
  await chin.getByRole("button", { name: "Remove this pose (Chin on hands)" }).click();
  await chin.getByRole("button", { name: "Tap again to remove it and its photos (Chin on hands)" }).click();
  await expect.poll(() => state.deleted).toEqual([CHIN.id]);
  await expect(page.getByRole("listitem", { name: "Chin on hands" })).toHaveCount(0);

  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations.map((v) => v.id)).toEqual([]);
});

const shoot: ShootDetail = {
  key: KEY, id: null, kind: "booking", date: DATE, start: "09:00", end: "11:00",
  title: "The Morales family", tabLabel: "Morales", bundleLine: "Our Little Story · 2 h · 2 backdrops", bundleName: "Our Little Story",
  place: "Miami Beach", inspoCount: 0, btsCount: 0, status: "confirmed",
  booking: {
    bookingId: "0b6f5a3e-1111-4222-8333-944455556666", reference: "TH-20261103-4821", status: "confirmed", date: DATE, start: "09:00", end: "11:00",
    durationMinutes: 120, parentName: "Maria Morales", defaultTitle: "The Morales family", defaultTabLabel: "Morales", bundleName: "Our Little Story",
    backdropsAllowed: 2, people: "Baby only", siblings: false, babies: [{ name: "Sofia", age: "Newborn (0–2 weeks)", gender: null }], family: [],
    backdrops: [], addons: [], pick: null, notes: null,
    address: "1500 Bay Rd, Miami Beach, FL 33139", city: "Miami Beach", mapUrl: "https://www.google.com/maps/search/?api=1&query=1500%20Bay%20Rd", deposit: null,
  },
  inspoTitle: "Inspo for Sofia", whoLine: "Sofia, newborn (0–2 weeks)", said: "", saidFromBooking: false,
  confirm: [], autoConfirm: [], bringExtra: [], inspo: [], sections: [],
};

test("day sheet: every family gets the signature poses to tick; the viewer marks one done", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const ticks = new Set<string>();
  const posts: { date: string; key: string; on: boolean }[] = [];
  const sheet: DaySheet = { date: DATE, sunset: "17:31", shoots: [shoot], bring: { backdrops: [], extras: [], sections: [] }, poses: [CHIN, TACO], ticks: [], ticked: 0, total: 2 };
  await page.route(`**/api/admin/shoots/day/${DATE}`, (route) => route.fulfill({ json: { day: { ...sheet, ticks: [...ticks] } } }));
  await page.route("**/api/admin/shoots/ticks", (route) => {
    const body = route.request().postDataJSON() as { date: string; key: string; on: boolean };
    posts.push(body);
    if (body.on) ticks.add(body.key);
    else ticks.delete(body.key);
    return route.fulfill({ status: 204 });
  });
  await page.goto(`/admin/shoots/${DATE}`);
  const family = page.getByRole("region", { name: "The Morales family" });
  await expect(family.getByRole("heading", { name: "Signature poses 0/2" })).toBeVisible();
  await expect(family.getByRole("list", { name: "How to set up Chin on hands" })).toContainText("Pillow under the hips");
  await expect(page.getByText("0 of 2 ticked")).toBeVisible();

  await family.getByRole("button", { name: "Done: Taco" }).click();
  await expect.poll(() => posts).toEqual([{ date: DATE, key: poseKey(KEY, TACO.id), on: true }]);
  await expect(family.getByRole("heading", { name: "Signature poses 1/2" })).toBeVisible();

  // the photo big, with how to set it up, and "Mark as done"
  await family.getByRole("button", { name: "See Chin on hands big (2 photos)" }).click();
  const viewer = page.getByRole("dialog");
  await expect(viewer).toContainText("Chin on hands: Pillow under the hips · Rolled towel under the chest");
  await viewer.getByRole("button", { name: /Mark as done/ }).click();
  await expect.poll(() => posts.at(-1)).toEqual({ date: DATE, key: poseKey(KEY, CHIN.id), on: true });
  await page.keyboard.press("Escape");
  await expect(page.getByText("2 of 2 ticked")).toBeVisible();

  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations.map((v) => v.id)).toEqual([]);
});

test("shoot folder: the signature poses are listed, with a link to change them", async ({ page }) => {
  await fakePoses(page);
  await page.route(`**/api/admin/shoots/${KEY}`, (route) => route.fulfill({ json: { shoot } }));
  await page.goto(`/admin/shoots/folder/${KEY}`);
  const poses = page.getByRole("region", { name: "Signature poses" });
  await expect(poses.getByText("Chin on hands", { exact: true })).toBeVisible();
  await expect(poses.getByText("Taco", { exact: true })).toBeVisible();
  await expect(poses.getByRole("button", { name: /Done:/ })).toHaveCount(0);
  await expect(poses.getByRole("link", { name: "Change them in Signature poses" })).toHaveAttribute("href", "/admin/shoots/poses");
});
