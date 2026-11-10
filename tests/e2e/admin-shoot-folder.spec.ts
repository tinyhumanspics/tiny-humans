import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { InspoItem, ShootDetail } from "@/lib/shoots/types";
import { signedInAdmin } from "./fixtures/admin";

/** /admin → Shoots → a shoot's folder (slice 3: links, text items, captions, notes). APIs faked. */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const KEY = "b-TH-20261103-4821";
const API = `**/api/admin/shoots/${KEY}`;

const item = (over: Partial<InspoItem>): InspoItem => ({
  id: "11111111-1111-4111-8111-111111111111",
  group: "inspo",
  type: "note",
  mediaUrl: null,
  contentType: null,
  width: null,
  height: null,
  linkUrl: null,
  platform: null,
  caption: "",
  who: [],
  sort: 0,
  ...over,
});

const MORALES: ShootDetail = {
  key: KEY,
  id: null,
  kind: "booking",
  date: "2026-11-16",
  start: "09:00",
  end: "11:00",
  title: "The Morales family",
  tabLabel: "Morales",
  bundleLine: "Our Little Story · 2 h · 2 backdrops",
  bundleName: "Our Little Story",
  place: "Miami Beach",
  inspoCount: 1,
  btsCount: 1,
  status: "confirmed",
  booking: {
    bookingId: "0b6f5a3e-1111-4222-8333-944455556666",
    reference: "TH-20261103-4821",
    status: "confirmed",
    date: "2026-11-16",
    start: "09:00",
    end: "11:00",
    durationMinutes: 120,
    parentName: "Maria Morales",
    defaultTitle: "The Morales family",
    defaultTabLabel: "Morales",
    bundleName: "Our Little Story",
    backdropsAllowed: 2,
    people: "Baby only",
    siblings: false,
    babies: [{ name: "Sofia", age: "Newborn (0–2 weeks)", gender: null }],
    family: [],
    backdrops: [{ id: "cream", name: "Cream", color: "#efe3cc" }, { id: "wooden", name: "Wooden", color: "#9a6a42" }],
    addons: [{ name: "Extra baby", quantity: 1, extraMinutes: 30 }],
    pick: { id: "basket-nap", title: "Basket nap", src: "/portfolio/basket-nap.jpg" },
    notes: "Sofia sleeps best right after her 9:00 feed.",
    address: "1500 Bay Rd, Miami Beach, FL 33139",
    city: "Miami Beach",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=1500%20Bay%20Rd",
    deposit: null,
  },
  inspoTitle: "Inspo for Sofia",
  whoLine: "Sofia, newborn (0–2 weeks)",
  said: "Sofia sleeps best right after her 9:00 feed.",
  saidFromBooking: true,
  confirm: [],
  autoConfirm: [],
  bringExtra: [],
  inspo: [
    item({ caption: "Basket nap, sleepy curl" }),
    item({ id: "22222222-2222-4222-8222-222222222222", group: "bts", type: "link", linkUrl: "https://www.instagram.com/reel/abc/", platform: "Instagram", caption: "Camera-back reveal" }),
  ],
};

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area (phone screenshots are separate)");
  await signedInAdmin(page);
});

/** Fakes GET + PATCH of the folder and the inspo routes; returns what the page sent. */
async function fakeFolder(page: Page, shoot: ShootDetail = MORALES) {
  const sent = { patches: [] as unknown[], added: [] as unknown[], captions: [] as { id: string; body: unknown }[], removed: [] as string[], deleted: 0 };
  let next = 3;
  await page.route(API, (route) => {
    const method = route.request().method();
    if (method === "PATCH") {
      sent.patches.push(route.request().postDataJSON());
      return route.fulfill({ json: { shoot } });
    }
    if (method === "DELETE") {
      sent.deleted += 1;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: { shoot } });
  });
  await page.route(`${API}/inspo`, (route) => {
    const body = route.request().postDataJSON() as { type: "link" | "note"; group: "inspo" | "bts"; url?: string };
    sent.added.push(body);
    const id = `3333333${next++}-3333-4333-8333-333333333333`;
    return route.fulfill({ status: 201, json: { item: item({ id, group: body.group, type: body.type, linkUrl: body.url ?? null, platform: body.url ? "Instagram" : null }) } });
  });
  await page.route(`${API}/inspo/*`, (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop()!;
    if (route.request().method() === "DELETE") {
      sent.removed.push(id);
      return route.fulfill({ status: 204 });
    }
    sent.captions.push({ id, body: route.request().postDataJSON() });
    return route.fulfill({ json: { item: item({ id }) } });
  });
  return sent;
}

test("a booking's folder: header facts, their pick, inspo and BTS cards", async ({ page }) => {
  await fakeFolder(page);
  await page.goto(`/admin/shoots/folder/${KEY}`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Morales family");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByText("Shoot folder · Mon Nov 16 · 9:00 to 11:00")).toBeVisible();
  await expect(page.getByRole("link", { name: "← All shoots" })).toHaveAttribute("href", "/admin/shoots");
  await expect(page.getByRole("link", { name: "Mon Nov 16 day sheet" })).toHaveAttribute("href", "/admin/shoots/2026-11-16");
  await expect(page.getByRole("link", { name: "Open the day sheet →" })).toHaveAttribute("href", "/admin/shoots/2026-11-16");

  const facts = page.getByRole("list", { name: "About this shoot" }).getByRole("listitem");
  await expect(facts).toHaveText([
    "Our Little Story · 2 h · 2 backdrops",
    "Sofia · Newborn (0–2 weeks)",
    "Baby only",
    "Cream",
    "Wooden",
    "Extra baby",
    "Miami Beach",
    "TH-20261103-4821",
  ]);
  await expect(page.getByRole("img", { name: "Their pick when booking: Basket nap" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Inspo for Sofia", level: 2 })).toBeVisible();
  await expect(page.getByLabel("What's the shot?")).toHaveValue("Basket nap, sleepy curl");
  const insta = page.getByRole("link", { name: /Instagram/ });
  await expect(insta).toHaveAttribute("href", "https://www.instagram.com/reel/abc/");
  await expect(insta).toHaveAttribute("target", "_blank");
  await expect(page.getByLabel("What's the idea?")).toHaveValue("Camera-back reveal");
  await expect(page.getByLabel("What the family asked for")).toHaveValue("Sofia sleeps best right after her 9:00 feed.");

  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);
});

test("paste a link: a bad one is explained, a good one becomes a card", async ({ page }) => {
  const sent = await fakeFolder(page);
  await page.goto(`/admin/shoots/folder/${KEY}`);
  const inspo = page.getByRole("region", { name: "Inspo for Sofia" });
  const field = inspo.getByLabel("Or paste a link");

  await field.fill("not a link");
  await inspo.getByRole("button", { name: "Add", exact: true }).click();
  await expect(inspo.getByText("That doesn't look like a web link.", { exact: false })).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  expect(sent.added).toEqual([]);

  await field.fill("instagram.com/reel/xyz");
  await inspo.getByRole("button", { name: "Add", exact: true }).click();
  await expect(inspo.getByText("Instagram link added. Write what it is below.")).toBeVisible();
  expect(sent.added).toEqual([{ type: "link", group: "inspo", url: "https://instagram.com/reel/xyz" }]);
  await expect(field).toHaveValue("");
  await expect(inspo.getByRole("link", { name: /Instagram/ })).toHaveCount(1);
});

test("a BTS idea with no photo: caption saves by itself; Remove takes two taps", async ({ page }) => {
  const sent = await fakeFolder(page);
  await page.goto(`/admin/shoots/folder/${KEY}`);
  const bts = page.getByRole("region", { name: "BTS on phones" });

  await bts.getByRole("button", { name: "+ Write an idea (no photo)" }).click();
  const fresh = bts.getByLabel("What's the idea?").last();
  await expect(fresh).toBeFocused();
  expect(sent.added).toEqual([{ type: "note", group: "bts", caption: "" }]);
  await fresh.fill("Leo seeing his sister on the set");
  await expect.poll(() => sent.captions.at(-1)?.body).toEqual({ caption: "Leo seeing his sister on the set" });

  const remove = bts.getByRole("button", { name: /^Remove \(Camera-back reveal\)/ });
  await remove.click();
  await expect(bts.getByRole("button", { name: /Tap again to remove \(Camera-back reveal\)/ })).toBeVisible();
  expect(sent.removed).toEqual([]);
  await bts.getByRole("button", { name: /Tap again to remove/ }).click();
  await expect(bts.getByRole("link", { name: /Instagram/ })).toHaveCount(0);
  expect(sent.removed).toEqual(["22222222-2222-4222-8222-222222222222"]);
});

test("notes: only the box that changed is sent, and it says Saved", async ({ page }) => {
  const sent = await fakeFolder(page);
  await page.goto(`/admin/shoots/folder/${KEY}`);
  await page.getByLabel("Still to confirm").fill("Leo (4) in a few?\nWhich backdrop first?");
  await expect(page.getByRole("complementary", { name: "Notes" }).getByRole("status")).toHaveText("Saved");
  expect(sent.patches).toEqual([{ confirm: "Leo (4) in a few?\nWhich backdrop first?" }]);
  await page.getByLabel("Bring extra").fill("Small stool for Leo");
  await expect.poll(() => sent.patches.at(-1)).toEqual({ bringExtra: "Small stool for Leo" });
});

test("a shoot without a booking: The idea, and Delete this shoot takes two taps", async ({ page }) => {
  const styled: ShootDetail = {
    ...MORALES,
    key: "0b6f5a3e-1111-4222-8333-944455556666",
    id: "0b6f5a3e-1111-4222-8333-944455556666",
    kind: "styled",
    date: "2026-11-19",
    start: "15:00",
    end: null,
    title: "First Christmas set test",
    bundleLine: null,
    bundleName: null,
    place: "Our place, Miami Beach",
    status: null,
    booking: null,
    inspoTitle: "Inspo for the set",
    whoLine: "No baby: just the set",
    said: "",
    saidFromBooking: false,
    inspo: [],
  };
  await page.route(`**/api/admin/shoots/${styled.key}`, (route) =>
    route.request().method() === "DELETE" ? route.fulfill({ status: 204 }) : route.fulfill({ json: { shoot: styled } }),
  );
  await page.route("**/api/admin/shoots?*", (route) => route.fulfill({ json: { days: [] } }));
  await page.goto(`/admin/shoots/folder/${styled.key}`);
  await expect(page.getByText("Shoot without a booking · Thu Nov 19 · 3:00")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inspo for the set" })).toBeVisible();
  await expect(page.getByLabel("The idea")).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toBeVisible();
  await expect(page.getByText("No ideas yet.")).toBeVisible();
  await page.getByRole("button", { name: "Delete this shoot" }).click();
  await page.getByRole("button", { name: "Tap again to delete this shoot" }).click();
  await page.waitForURL("**/admin/shoots");
});

test("a folder that doesn't exist says so", async ({ page }) => {
  await page.route("**/api/admin/shoots/b-TH-20990101-1234", (route) => route.fulfill({ status: 404, json: { error: "That shoot isn't here anymore." } }));
  await page.goto("/admin/shoots/folder/b-TH-20990101-1234");
  await expect(page.getByRole("heading", { name: "Not found", level: 1 })).toBeVisible();
  await expect(page.getByText("That shoot isn't here anymore.")).toBeVisible();
});
