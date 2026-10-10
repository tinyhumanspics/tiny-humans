import { expect, test } from "@playwright/test";
import { activeSeasonalOffers } from "@/lib/seasonal/offers";
import { parseSettings } from "@/lib/settings/defaults";
import type { SiteSettings } from "@/lib/settings/types";

const seasonalOffers: SiteSettings["seasonalOffers"] = {
  thanksgiving: { enabled: true, title: "Baby’s First Thanksgiving", description: "Thanksgiving description", cutoff: "2026-11-23", spanish: null },
  firstChristmas: { enabled: true, title: "Baby’s First Christmas", description: "First Christmas description", cutoff: "2026-12-21", spanish: { title: "La primera Navidad de tu bebé", description: "Fotos navideñas en casa" } },
};

test("seasonal offers follow the live theme and inclusive cutoff dates", () => {
  expect(activeSeasonalOffers(seasonalOffers, "thanksgiving", "2026-11-23").map((offer) => offer.id)).toEqual(["thanksgiving"]);
  expect(activeSeasonalOffers(seasonalOffers, "thanksgiving", "2026-11-24")).toEqual([]);
  expect(activeSeasonalOffers(seasonalOffers, "christmas", "2026-12-21").map((offer) => offer.id)).toEqual(["firstChristmas"]);
  expect(activeSeasonalOffers(seasonalOffers, "christmas", "2026-12-22")).toEqual([]);
  expect(activeSeasonalOffers(seasonalOffers, "default", "2026-10-08")).toEqual([]);
  expect(activeSeasonalOffers(seasonalOffers, "christmas", "2026-12-21", "es").map((offer) => ({ id: offer.id, title: offer.title }))).toEqual([
    { id: "firstChristmas", title: "La primera Navidad de tu bebé" },
  ]);
});

test("older settings drop Christmas Cards and keep the two remaining offers", () => {
  const parsed = parseSettings({
    themeId: "christmas",
    media: {},
    seasonalOffers: {
      thanksgiving: { enabled: true, title: "Baby's First Thanksgiving at Home", description: "Thanksgiving description", cutoff: "2026-11-23" },
      christmasCards: { enabled: true, title: "Christmas Cards at Home", description: "Cards description", cutoff: "2026-12-05" },
      firstChristmas: { enabled: true, title: "Baby's First Christmas at Home", description: "First Christmas description", cutoff: "2026-12-21" },
    },
  });
  expect(Object.keys(parsed.seasonalOffers)).toEqual(["thanksgiving", "firstChristmas"]);
  expect(parsed.seasonalOffers.thanksgiving.title).toBe("Baby’s First Thanksgiving");
  expect(parsed.seasonalOffers.firstChristmas.title).toBe("Baby’s First Christmas");
  expect(Object.values(parsed.seasonalOffers).every((offer) => offer.enabled === true)).toBe(true);
});

test("the owner can edit and enable seasonal landing offers", async ({ page }, testInfo) => {
  const initial: SiteSettings = { themeId: "christmas", media: {}, seasonalOffers, updatedAt: null };
  let saved: SiteSettings = initial;

  await page.route("**/api/admin/session", (route) => route.fulfill({ json: { authenticated: true, authConfigured: true, storageConfigured: true } }));
  await page.route("**/api/admin/settings", async (route) => {
    if (route.request().method() === "PUT") {
      saved = route.request().postDataJSON() as SiteSettings;
      await route.fulfill({ json: { ...saved, updatedAt: "2026-10-08T12:00:00.000Z" } });
      return;
    }
    await route.fulfill({ json: initial });
  });

  await page.goto("/admin/seasonal");
  await expect(page.getByRole("heading", { name: "Seasonal landing offers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Baby’s First Thanksgiving" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Baby’s First Christmas" })).toBeVisible();
  await expect(page.getByText("Christmas cards", { exact: true })).toHaveCount(0);
  await page.getByLabel("Offer title", { exact: true }).nth(1).fill("Baby’s First Christmas");
  await page.getByLabel("Spanish offer title").nth(1).fill("La primera Navidad de tu bebé");
  await page.getByLabel("Spanish short description").nth(1).fill("");
  await page.getByLabel("Last session date").nth(1).fill("2026-12-21");
  await page.getByRole("button", { name: "Save seasonal offers" }).click();
  await expect(page.getByText("Complete both Spanish fields for Baby’s First Christmas, or leave both blank.")).toBeVisible();
  await page.getByLabel("Spanish short description").nth(1).fill("Una sesión especial para la primera Navidad de tu bebé.");
  await page.getByRole("button", { name: "Save seasonal offers" }).click();

  await expect(page.getByText("Seasonal landing settings are live.")).toBeVisible();
  expect(Object.keys(saved.seasonalOffers)).toEqual(["thanksgiving", "firstChristmas"]);
  expect(saved.seasonalOffers.firstChristmas.title).toBe("Baby’s First Christmas");
  expect(saved.seasonalOffers.firstChristmas.spanish).toEqual({ title: "La primera Navidad de tu bebé", description: "Una sesión especial para la primera Navidad de tu bebé." });
  expect(saved.seasonalOffers.firstChristmas.cutoff).toBe("2026-12-21");
  if (process.env.CAPTURE_SEASONAL_I18N === "1") {
    await page.getByLabel("Spanish offer title").nth(1).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.screenshots/seasonal-i18n/${testInfo.project.name}.png` });
  }
});
