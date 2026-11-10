import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { DaySheet, InspoItem, ShootDetail } from "@/lib/shoots/types";
import { signedInAdmin } from "./fixtures/admin";

/** Owner, Nov 10: twins and family shoots. Each person listed; shot ideas say who's in them; the day sheet groups them. APIs faked. */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const DATE = "2026-11-18";
const KEY = "b-TH-20261104-5150";
const API = `**/api/admin/shoots/${KEY}`;

const item = (id: string, caption: string, who: string[], group: "inspo" | "bts" = "inspo"): InspoItem => ({
  id, group, type: "note", mediaUrl: null, contentType: null, width: null, height: null, linkUrl: null, platform: null, caption, who, sort: 0,
});

const RIVERAS: ShootDetail = {
  key: KEY, id: "1c6f5a3e-1111-4222-8333-944455556666", kind: "booking", date: DATE, start: "10:00", end: "13:30",
  title: "The Rivera family", tabLabel: "Rivera", bundleLine: "Our Family Story · 3 h 30 min · 3 backdrops", bundleName: "Our Family Story",
  place: "Coral Gables", inspoCount: 5, btsCount: 1, status: "confirmed",
  booking: {
    bookingId: "1c6f5a3e-1111-4222-8333-944455556666", reference: "TH-20261104-5150", status: "confirmed", date: DATE, start: "10:00", end: "13:30",
    durationMinutes: 210, parentName: "Ana Rivera", defaultTitle: "The Rivera family", defaultTabLabel: "Rivera", bundleName: "Our Family Story",
    backdropsAllowed: 3, people: "Baby + parents + siblings", siblings: true,
    babies: [{ name: "David", age: "Newborn (0–2 weeks)", gender: "boy" }, { name: "Mia", age: "Newborn (0–2 weeks)", gender: "girl" }],
    family: [{ role: "mom", name: "Ana" }, { role: "dad" }, { role: "brother", name: "Leo" }],
    backdrops: [], addons: [{ name: "Extra baby", quantity: 1, extraMinutes: 30 }], pick: null, notes: null,
    address: "200 Alhambra Cir, Coral Gables, FL 33134", city: "Coral Gables", mapUrl: "https://www.google.com/maps/search/?api=1&query=200%20Alhambra", deposit: null,
  },
  inspoTitle: "Inspo for David and Mia", whoLine: "David, newborn (0–2 weeks) and Mia, newborn (0–2 weeks), with Mom (Ana), Dad, Brother (Leo)",
  said: "", saidFromBooking: false, confirm: [], autoConfirm: [], bringExtra: [],
  inspo: [
    item("aaaaaaaa-0000-4000-8000-000000000001", "Twins in the basket", ["baby:0", "baby:1"]),
    item("aaaaaaaa-0000-4000-8000-000000000002", "David close-up", ["baby:0"]),
    item("aaaaaaaa-0000-4000-8000-000000000003", "Family on the bed", ["all"]),
    item("aaaaaaaa-0000-4000-8000-000000000004", "Dad and Leo holding David", ["baby:0", "fam:1", "fam:2"]),
    item("aaaaaaaa-0000-4000-8000-000000000005", "Window light", []),
    item("aaaaaaaa-0000-4000-8000-000000000006", "Camera-back reveal", [], "bts"),
  ],
};

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area (phone size set per test)");
  await signedInAdmin(page);
});

async function fakeFolder(page: Page) {
  const whoSaves: { id: string; who: unknown }[] = [];
  await page.route(API, (route) => route.fulfill({ json: { shoot: RIVERAS } }));
  await page.route(`${API}/inspo/*`, (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop()!;
    const body = route.request().postDataJSON() as { who?: string[] };
    whoSaves.push({ id, who: body.who });
    return route.fulfill({ json: { item: { ...RIVERAS.inspo.find((i) => i.id === id)!, who: body.who ?? [] } } });
  });
  return whoSaves;
}

test("folder: each baby and family member listed; each shot idea says who's in it", async ({ page }) => {
  const saves = await fakeFolder(page);
  await page.goto(`/admin/shoots/folder/${KEY}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Rivera family");

  const facts = page.getByRole("list", { name: "About this shoot" });
  for (const text of ["David · Boy · Newborn (0–2 weeks)", "Mia · Girl · Newborn (0–2 weeks)", "Mom (Ana)", "Dad", "Brother (Leo)"]) {
    await expect(facts.getByText(text, { exact: true })).toBeVisible();
  }

  // inspo cards have the picker, BTS ideas don't
  await expect(page.getByRole("group", { name: "Who's in it?" })).toHaveCount(5);
  // the fifth idea, "Window light", isn't picked yet
  const loose = page.getByRole("group", { name: "Who's in it?" }).nth(4);
  await expect(loose.getByRole("button", { name: "Everyone" })).toHaveAttribute("aria-pressed", "false");
  await expect(loose.getByRole("button")).toHaveText(["Everyone", "David", "Mia", "Mom (Ana)", "Dad", "Brother (Leo)"]);

  await loose.getByRole("button", { name: "Mom (Ana)" }).click();
  await loose.getByRole("button", { name: "Mia" }).click();
  await expect(loose.getByRole("button", { name: "Mia" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => saves.at(-1)).toEqual({ id: "aaaaaaaa-0000-4000-8000-000000000005", who: ["baby:1", "fam:0"] });
  // Everyone replaces the rest
  await loose.getByRole("button", { name: "Everyone" }).click();
  await expect(loose.getByRole("button", { name: "Mia" })).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => saves.at(-1)).toEqual({ id: "aaaaaaaa-0000-4000-8000-000000000005", who: ["all"] });

  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("day sheet: who's in the photos, then the shots in sections by who's in them", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const sheet: DaySheet = { date: DATE, sunset: "17:30", shoots: [RIVERAS], bring: { backdrops: [], extras: [], sections: [] }, ticks: [], ticked: 0, total: 6 };
  await page.route(`**/api/admin/shoots/day/${DATE}`, (route) => route.fulfill({ json: { day: sheet } }));
  await page.route("**/api/admin/shoots/ticks", (route) => route.fulfill({ status: 204 }));
  await page.goto(`/admin/shoots/${DATE}`);

  const people = page.getByRole("list", { name: "Who's in the photos" });
  await expect(people.getByRole("listitem")).toHaveText(["David · Boy · Newborn (0–2 weeks)", "Mia · Girl · Newborn (0–2 weeks)", "Mom (Ana)", "Dad", "Brother (Leo)"]);

  await expect(page.getByRole("heading", { level: 4 })).toHaveText([
    "Everyone together 0/1",
    "David, Dad & Brother (Leo) 0/1",
    "David & Mia 0/1",
    "David 0/1",
    "Not picked yet 0/1",
  ]);
  await expect(page.getByText("Boy · Newborn (0–2 weeks)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done: David close-up" }).click();
  await expect(page.getByRole("heading", { level: 4, name: /^David 1\/1/ })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
