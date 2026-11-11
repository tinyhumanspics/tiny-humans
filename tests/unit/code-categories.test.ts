import { describe, expect, test } from "vitest";
import { CODE_CATEGORY_PRESETS, cleanCodeCategory, codeCategoryOptions, filterByCategory, NO_CATEGORY } from "@/lib/pricing/code-categories";

describe("discount code categories (owner, Nov 10)", () => {
  test("the presets come first, then the owner's own categories A–Z without repeats", () => {
    expect(CODE_CATEGORY_PRESETS).toEqual(["Thanksgiving offer", "Christmas offer", "Happy Valentine's offer"]);
    expect(codeCategoryOptions([null, "Mother's Day offer", "christmas offer", " Black  Friday ", "mother's day offer", undefined])).toEqual([
      "Thanksgiving offer",
      "Christmas offer",
      "Happy Valentine's offer",
      "Black Friday",
      "Mother's Day offer",
    ]);
  });

  test("typed categories are tidied; empty means none", () => {
    expect(cleanCodeCategory("  Spring   mini  sessions ")).toBe("Spring mini sessions");
    expect(cleanCodeCategory("   ")).toBeNull();
    expect(cleanCodeCategory(null)).toBeNull();
    expect(cleanCodeCategory("x".repeat(80))).toHaveLength(60);
  });

  test("the codes list filter", () => {
    const codes = [{ code: "GIFT15", category: "Thanksgiving offer" }, { code: "XMAS10", category: "Christmas offer" }, { code: "FRIENDS", category: null }];
    expect(filterByCategory(codes, "").map((c) => c.code)).toEqual(["GIFT15", "XMAS10", "FRIENDS"]);
    expect(filterByCategory(codes, "thanksgiving offer").map((c) => c.code)).toEqual(["GIFT15"]);
    expect(filterByCategory(codes, NO_CATEGORY).map((c) => c.code)).toEqual(["FRIENDS"]);
  });
});
