import { expect, test } from "@playwright/test";
import { activeSeasonalOffers } from "@/lib/seasonal/offers";
import { parseSettings } from "@/lib/settings/defaults";
import type { SiteSettings } from "@/lib/settings/types";

const seasonalOffers: SiteSettings["seasonalOffers"] = [
  { id: "thanksgiving", name: "Baby’s First Thanksgiving", themeId: "thanksgiving", enabled: true, title: "Baby’s First Thanksgiving", description: "Thanksgiving description", cutoff: "2026-11-23", spanish: null },
  { id: "firstChristmas", name: "Baby’s First Christmas", themeId: "christmas", enabled: true, title: "Baby’s First Christmas", description: "First Christmas description", cutoff: "2026-12-21", spanish: { title: "La primera Navidad de tu bebé", description: "Fotos navideñas en casa" } },
];
const byId = (s: Pick<SiteSettings, "seasonalOffers">, id: string) => s.seasonalOffers.find((o) => o.id === id)!;

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
  expect(parsed.seasonalOffers.map((o) => o.id)).toEqual(["thanksgiving", "firstChristmas", "valentines"]);
  expect(byId(parsed, "thanksgiving").title).toBe("Baby’s First Thanksgiving");
  expect(byId(parsed, "firstChristmas").title).toBe("Baby’s First Christmas");
  expect(parsed.seasonalOffers.filter((offer) => offer.id !== "valentines").every((offer) => offer.enabled === true)).toBe(true);
  expect(parsed.spanishPublished).toBe(false);
  expect(parseSettings({ ...parsed, spanishPublished: true }).spanishPublished).toBe(true);
});

test("the owner can edit and enable seasonal landing offers", async ({ page }, testInfo) => {
  const initial: SiteSettings = { themeId: "christmas", spanishPublished: false, media: {}, seasonalOffers, updatedAt: null };
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
  await expect(page.getByRole("heading", { name: "Seasonal offers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Baby’s First Thanksgiving" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Baby’s First Christmas" })).toBeVisible();
  await expect(page.getByText("Christmas cards", { exact: true })).toHaveCount(0);
  await page.getByLabel("Offer title", { exact: true }).nth(1).fill("Baby’s First Christmas");
  await page.getByLabel("Spanish offer title").nth(1).fill("La primera Navidad de tu bebé");
  await page.getByLabel("Spanish short description").nth(1).fill("");
  await page.getByLabel("Last session date").nth(1).fill("2026-12-21");
  await page.getByRole("button", { name: "Save seasonal offers" }).click();
  await expect(page.getByText("Complete both Spanish fields for Baby’s First Christmas, or leave both blank and they're filled in for you when you save.")).toBeVisible();
  await page.getByLabel("Spanish short description").nth(1).fill("Una sesión especial para la primera Navidad de tu bebé.");
  await page.getByRole("button", { name: "Save seasonal offers" }).click();

  await expect(page.getByText(/Seasonal offers saved/)).toBeVisible();
  expect(saved.seasonalOffers.map((o) => o.id)).toEqual(["thanksgiving", "firstChristmas", "valentines"]);
  expect(byId(saved, "firstChristmas").title).toBe("Baby’s First Christmas");
  expect(byId(saved, "firstChristmas").spanish).toEqual({ title: "La primera Navidad de tu bebé", description: "Una sesión especial para la primera Navidad de tu bebé." });
  expect(byId(saved, "firstChristmas").cutoff).toBe("2026-12-21");

  // the owner adds their own offer (Valentine's Day, any theme), and can delete it again
  await page.getByRole("button", { name: "+ Add another offer" }).click();
  await page.getByLabel("Name (only you see it)").fill("Valentine's Day");
  await page.getByLabel("Offer title", { exact: true }).nth(3).fill("Show love to your tiny human");
  await page.getByRole("textbox", { name: /^Short description/ }).nth(3).fill("A sweet at-home session all February.");
  await page.getByLabel("Last session date").nth(3).fill("2027-02-28");
  await page.getByLabel("Show offer").nth(3).check();
  await page.getByRole("button", { name: "Save seasonal offers" }).click();
  await expect(page.getByText(/Seasonal offers saved/)).toBeVisible();
  const own = saved.seasonalOffers[3];
  expect(own).toMatchObject({ name: "Valentine's Day", themeId: "any", enabled: true, title: "Show love to your tiny human", cutoff: "2027-02-28" });
  expect(own.id).toMatch(/^offer-/);
  await expect(page.getByRole("button", { name: "Delete this offer" })).toHaveCount(1);
  if (process.env.CAPTURE_SEASONAL_I18N === "1") {
    await page.getByLabel("Spanish offer title").nth(1).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.screenshots/seasonal-i18n/${testInfo.project.name}.png` });
  }
});
