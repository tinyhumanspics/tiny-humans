import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { everyoneLine, waiverFacts } from "@/lib/waiver/facts";
import { FAMILY_WAIVER_VERSION, waiverKindOf, waiverSnapshot, waiverVersionFor, waiverWords, WAIVER_VERSION } from "@/lib/waiver/text";
import { signSchema } from "@/lib/waiver/validation";

/** Our Family Story's family photo release (owner, Nov 11). */
const ctx = { parentName: "Maria Morales", children: [{ name: "Sofia", age: "Newborn (0–2 weeks)" }], sessionDate: "2026-11-16", kind: "family" as const, family: [{ role: "dad" as const, name: "Carlos" }, { role: "brother" as const, name: "Leo" }, { role: "grandma" as const }] };

describe("family photo release", () => {
  test("its own title, version and fine print; the same choices and promises as the baby release", () => {
    const fam = waiverSnapshot("en", waiverFacts(ctx, "en"), "family");
    const baby = waiverSnapshot("en", waiverFacts(ctx, "en"));
    expect(fam.version).toBe(FAMILY_WAIVER_VERSION);
    expect(baby.version).toBe(WAIVER_VERSION);
    expect(fam.title).toBe("Family photo and video release");
    expect(fam.fine).toContain("For the other people in the photos, I confirm that each adult agreed to this release, and that each child's parent or legal guardian did too.");
    expect(fam.uses).toEqual(baby.uses);
    expect(fam.promises).toEqual(baby.promises);
    expect(Object.keys(fam)).toEqual(Object.keys(baby));
  });

  test("the top line lists everyone else in the photos; first names cover the family too", () => {
    const fam = waiverSnapshot("en", waiverFacts(ctx, "en"), "family");
    expect(fam.facts).toBe("Your little one: Sofia · Also in the photos: Carlos (Dad), Leo (Brother), Grandma · The Morales family · Mon, Nov 16");
    expect(fam.firstName?.label).toBe("OK to use first names in captions (Sofia, Carlos and Leo)");
    const es = waiverSnapshot("es", waiverFacts(ctx, "es"), "family");
    expect(es.title).toBe("Autorización de fotos y videos familiares");
    expect(es.facts).toContain("También en las fotos: Carlos (Papá), Leo (Hermano), Abuela");
    expect(es.firstName?.label).toBe("Está bien usar los primeros nombres en los textos (Sofia, Carlos y Leo)");
    // nobody listed and no names: no extra line, no first-name question
    const bare = waiverSnapshot("en", waiverFacts({ ...ctx, children: [{ name: null, age: "x" }], family: [] }, "en"), "family");
    expect(bare.facts).toBe("Your little one: — · The Morales family · Mon, Nov 16");
    expect(bare.firstName).toBeNull();
    expect(everyoneLine([], "en")).toBeNull();
  });

  test("the baby release is exactly as before (the family list never changes it)", () => {
    const baby = waiverSnapshot("en", waiverFacts({ ...ctx, kind: "baby" }, "en"));
    expect(baby.facts).toBe("Your little one: Sofia · The Morales family · Mon, Nov 16");
    expect(baby.firstName?.label).toBe("OK to use Sofia's first name in captions");
  });

  test("a stored version says which release it was; Done accepts either version", () => {
    expect(waiverKindOf(FAMILY_WAIVER_VERSION)).toBe("family");
    expect(waiverKindOf(WAIVER_VERSION)).toBe("baby");
    expect(waiverVersionFor("family")).toBe(FAMILY_WAIVER_VERSION);
    const sig = signSchema.shape.version;
    expect(sig.safeParse(FAMILY_WAIVER_VERSION).success).toBe(true);
    expect(sig.safeParse("old").success).toBe(false);
  });

  test("v1's family wording is pinned: changing it needs a new FAMILY_WAIVER_VERSION", () => {
    const words = JSON.stringify([waiverWords("en", "family"), waiverWords("es", "family")]);
    expect(FAMILY_WAIVER_VERSION).toBe("Family photo and video release v1 (draft, Nov 2026)");
    expect(createHash("sha256").update(words).digest("hex").slice(0, 16)).toMatchInlineSnapshot(`"2df97002dce2ca8e"`);
  });
});
