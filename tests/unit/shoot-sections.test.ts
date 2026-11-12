import { describe, expect, test } from "vitest";
import { groupTitle, newSectionName, sectionBlocks, sectionsIn } from "@/lib/shoots/sections";
import type { InspoItem, ShootSection } from "@/lib/shoots/types";
import { inspoPatchSchema, newInspoSchema, newSectionSchema, sectionPatchSchema } from "@/lib/shoots/validation";

/** /admin → Shoots: the owner's own sections inside Inspo and BTS (owner, Nov 12). */
const S1 = "aaaaaaaa-1111-4111-8111-111111111111";
const S2 = "bbbbbbbb-2222-4222-8222-222222222222";
const GONE = "cccccccc-3333-4333-8333-333333333333";
const item = (id: string, over: Partial<InspoItem> = {}): InspoItem => ({ id, group: "inspo", type: "note", mediaUrl: null, contentType: null, width: null, height: null, linkUrl: null, platform: null, caption: id, who: [], sectionId: null, sort: 0, ...over });
const sections: ShootSection[] = [
  { id: S2, group: "inspo", name: "Inspo for David · Reel", sort: 1 },
  { id: S1, group: "inspo", name: "Inspo for David · Outfit 2", sort: 0 },
  { id: "dddddddd-4444-4444-8444-444444444444", group: "bts", name: "BTS on phones · Section 2", sort: 0 },
];

describe("shoots: the owner's sections", () => {
  test("main list first, then the sections in order; a shot whose section is gone shows in the main one", () => {
    const items = [item("a"), item("b", { sectionId: S1 }), item("c", { sectionId: S2 }), item("d", { sectionId: GONE }), item("e", { group: "bts" }), item("f", { sectionId: S1 })];
    expect(sectionBlocks("inspo", items, sections, "Inspo for David").map((b) => [b.id, b.title, b.items.map((i) => i.id)])).toEqual([
      [null, "Inspo for David", ["a", "d"]],
      [S1, "Inspo for David · Outfit 2", ["b", "f"]],
      [S2, "Inspo for David · Reel", ["c"]],
    ]);
    expect(sectionBlocks("bts", items, sections, "Inspo for David").map((b) => [b.title, b.items.map((i) => i.id)])).toEqual([
      ["BTS on phones", ["e"]],
      ["BTS on phones · Section 2", []],
    ]);
    expect(sectionBlocks("inspo", [item("a")], [], "Inspo for the set")).toEqual([{ id: null, title: "Inspo for the set", items: [item("a")] }]);
    expect(sectionsIn(sections, "bts")).toHaveLength(1);
    expect(groupTitle("bts", "Inspo for David")).toBe("BTS on phones");
  });

  test("a new section starts as “<title> · Section 2”, then 3…, skipping names already used", () => {
    expect(newSectionName("inspo", [], "Inspo for David")).toBe("Inspo for David · Section 2");
    expect(newSectionName("inspo", sections, "Inspo for David")).toBe("Inspo for David · Section 2");
    const taken: ShootSection[] = [{ id: S1, group: "inspo", name: "inspo for david · section 2", sort: 0 }];
    expect(newSectionName("inspo", taken, "Inspo for David")).toBe("Inspo for David · Section 3");
    expect(newSectionName("bts", sections, "Inspo for David")).toBe("BTS on phones · Section 3");
  });

  test("what the API accepts: a section on new shots and moves, names 1–80 characters", () => {
    expect(newInspoSchema.safeParse({ type: "link", group: "inspo", url: "instagram.com/reel/DWowsEjjQlE", sectionId: S1 }).success).toBe(true);
    expect(newInspoSchema.safeParse({ type: "note", group: "bts", caption: "", sectionId: null }).success).toBe(true);
    expect(newInspoSchema.safeParse({ type: "note", group: "bts", caption: "", sectionId: "nope" }).success).toBe(false);
    expect(inspoPatchSchema.safeParse({ sectionId: S2 }).success).toBe(true);
    expect(inspoPatchSchema.safeParse({ sectionId: null }).success).toBe(true);
    expect(inspoPatchSchema.safeParse({}).success).toBe(false);
    expect(newSectionSchema.safeParse({ group: "inspo", name: "  Outfit 2 " })).toMatchObject({ success: true, data: { group: "inspo", name: "Outfit 2" } });
    expect(newSectionSchema.safeParse({ group: "inspo", name: "   " }).success).toBe(false);
    expect(newSectionSchema.safeParse({ group: "other", name: "x" }).success).toBe(false);
    expect(sectionPatchSchema.safeParse({ name: "x".repeat(81) }).success).toBe(false);
  });
});
