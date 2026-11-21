import { describe, expect, test } from "vitest";
import { defaultSettings, parseSettings, storedSettings } from "@/lib/settings/defaults";
import type { SeasonalOffer } from "@/lib/settings/types";

const valentines: SeasonalOffer = {
  id: "offer-valentines",
  name: "Valentine's Day",
  themeId: "any",
  enabled: true,
  title: "Show love to your tiny human",
  description: "A sweet at-home session all February.",
  cutoff: "2027-02-28",
  spanish: { title: "Muestra amor a tu pequeño", description: "Una sesión tierna en casa todo febrero." },
};

describe("seasonal offers (owner, Nov 10: shown on the ad page and the home page; the owner can add more)", () => {
  test("settings saved before Nov 10 (the { thanksgiving, firstChristmas } record) still read the same", () => {
    const parsed = parseSettings({ seasonalOffers: { thanksgiving: { enabled: true, title: "Baby’s First Thanksgiving", description: "Cozy.", cutoff: "2026-11-23", spanish: null } } });
    expect(parsed.seasonalOffers.map((o) => o.id)).toEqual(["thanksgiving", "firstChristmas", "valentines"]);
    expect(parsed.seasonalOffers[0]).toMatchObject({ themeId: "thanksgiving", enabled: true, description: "Cozy.", cutoff: "2026-11-23" });
    expect(parsed.seasonalOffers[1]).toMatchObject({ themeId: "christmas", enabled: false });
    // the Valentine's offer (owner, Nov 10) is there from the start, switched off, for the Valentine's theme
    expect(parsed.seasonalOffers[2]).toMatchObject({ themeId: "valentines", enabled: false, title: "Show love to your tiny human", cutoff: "2027-02-28" });
  });

  test("the owner's own offers save, read back, and keep the old record for a code revert", () => {
    const settings = { ...defaultSettings, seasonalOffers: [...defaultSettings.seasonalOffers, valentines] };
    const stored = storedSettings(settings) as { seasonalOffers: Record<string, unknown>; seasonalOfferList: unknown[] };
    expect(Object.keys(stored.seasonalOffers)).toEqual(["thanksgiving", "firstChristmas", "valentines"]);
    expect(stored.seasonalOfferList).toHaveLength(4);
    expect(parseSettings(JSON.parse(JSON.stringify(stored))).seasonalOffers).toEqual(settings.seasonalOffers);
    // what /admin sends (the list under seasonalOffers) reads the same
    expect(parseSettings({ seasonalOffers: settings.seasonalOffers }).seasonalOffers).toEqual(settings.seasonalOffers);
  });

  test("the built-in two can't be lost; bad ids and incomplete offers stay hidden", () => {
    const parsed = parseSettings({ seasonalOfferList: [{ ...valentines, id: "../evil" }, { ...valentines, id: "offer-half", title: "", enabled: true }] });
    expect(parsed.seasonalOffers.map((o) => o.id)).toEqual(["thanksgiving", "firstChristmas", "valentines", "offer-half"]);
    expect(parsed.seasonalOffers[3].enabled).toBe(false);
  });
});
