import { expect, test } from "@playwright/test";
import { activeSeasonalOffers } from "@/lib/seasonal/offers";
import { parseSettings } from "@/lib/settings/defaults";
import type { SiteSettings } from "@/lib/settings/types";

const seasonalOffers: SiteSettings["seasonalOffers"] = {
  thanksgiving: { enabled: true, title: "Thanksgiving Test", description: "Thanksgiving description", cutoff: "2026-11-23" },
  christmasCards: { enabled: true, title: "Cards Test", description: "Cards description", cutoff: "2026-12-05" },
  firstChristmas: { enabled: true, title: "First Christmas Test", description: "First Christmas description", cutoff: "2026-12-21" },
};

test("seasonal offers follow the live theme and inclusive cutoff dates", () => {
  expect(activeSeasonalOffers(seasonalOffers, "thanksgiving", "2026-11-23").map((offer) => offer.id)).toEqual(["thanksgiving"]);
  expect(activeSeasonalOffers(seasonalOffers, "thanksgiving", "2026-11-24")).toEqual([]);
  expect(activeSeasonalOffers(seasonalOffers, "christmas", "2026-12-05").map((offer) => offer.id)).toEqual(["christmasCards", "firstChristmas"]);
  expect(activeSeasonalOffers(seasonalOffers, "christmas", "2026-12-06").map((offer) => offer.id)).toEqual(["firstChristmas"]);
  expect(activeSeasonalOffers(seasonalOffers, "default", "2026-10-08")).toEqual([]);
});

test("older settings keep seasonal offers hidden until the owner saves them", () => {
  const parsed = parseSettings({ themeId: "christmas", media: {} });
  expect(Object.values(parsed.seasonalOffers).every((offer) => offer.enabled === false)).toBe(true);
  expect(parsed.seasonalOffers.christmasCards.cutoff).toBe("2026-12-05");
});

test("the owner can edit and enable seasonal landing offers", async ({ page }) => {
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
  await page.getByLabel("Offer title").nth(1).fill("Christmas Cards, Right at Home");
  await page.getByLabel("Last session date").nth(1).fill("2026-12-06");
  await page.getByRole("button", { name: "Save seasonal offers" }).click();

  await expect(page.getByText("Seasonal landing settings are live.")).toBeVisible();
  expect(saved.seasonalOffers.christmasCards.title).toBe("Christmas Cards, Right at Home");
  expect(saved.seasonalOffers.christmasCards.cutoff).toBe("2026-12-06");
});
