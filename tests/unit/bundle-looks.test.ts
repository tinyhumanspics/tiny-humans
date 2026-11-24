import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { setupsOf } from "@/config/backdrops";
import { featuresWithLooks, isLooksCount, looksOf } from "@/lib/pricing/looks";
import { requestSchema } from "@/lib/requests/validation";

/** Owner, Nov 24: each bundle says what it includes, look by look; bundles with 2+ setups ask for prop ideas on /book. */

describe("bundle looks", () => {
  test("the first line counts them, then one look per line; the name before the colon is the look's name", () => {
    expect(looksOf("2 looks\nCozy Wrap: swaddled and sleeping on your first backdrop.\nLittle Nest: a second backdrop with a prop, like a basket or tiny bed.")).toEqual({
      title: "2 looks",
      items: [
        { name: "Cozy Wrap", text: "swaddled and sleeping on your first backdrop." },
        { name: "Little Nest", text: "a second backdrop with a prop, like a basket or tiny bed." },
      ],
    });
    // a line without a name stays whole
    expect(looksOf("3 looks plus family\nCozy Wrap, Little Nest, and Dreamland, a third backdrop styled with props.\nFamily Hug: photos with mom, dad and siblings.")?.items[0]).toEqual({
      name: null,
      text: "Cozy Wrap, Little Nest, and Dreamland, a third backdrop styled with props.",
    });
    // one line is just one line; nothing written, nothing shown
    expect(looksOf("Cozy Wrap: baby swaddled")).toEqual({ title: null, items: [{ name: "Cozy Wrap", text: "baby swaddled" }] });
    expect(looksOf("  \n ")).toBeNull();
    expect(looksOf(undefined)).toBeNull();
  });

  test("the looks replace the setups line on screen, while the backdrop count still reads it", () => {
    const features = ["Up to 2 hours", "Baby only", "2 setups", "20 edited digital photos"];
    const looks = looksOf("2 looks\nCozy Wrap: a\nLittle Nest: b");
    expect(featuresWithLooks(features, looks, "drop")).toEqual(["Up to 2 hours", "Baby only", "20 edited digital photos"]);
    expect(featuresWithLooks(features, looks, "swap")).toEqual(["Up to 2 hours", "Baby only", "2 looks", "20 edited digital photos"]);
    expect(featuresWithLooks(features, null, "drop")).toEqual(features);
    for (const line of ["1 look", "2 setups", "3 set-ups", "2 escenarios", "1 estilo"]) expect(isLooksCount(line)).toBe(true);
    for (const line of ["Up to 2 hours", "20 edited digital photos", "Baby + parents + siblings"]) expect(isLooksCount(line)).toBe(false);
    expect(setupsOf(features)).toBe(2);
  });

  test("migration 0048 fills empty looks only, English and Spanish together, and removes nothing", () => {
    const sql = readFileSync("drizzle/0048_bundle_looks.sql", "utf8");
    for (const id of ["little-moments", "our-little-story", "forever-little"]) expect(sql).toContain(`"id" = '${id}' AND coalesce("description", '') = ''`);
    expect(sql.match(/UPDATE "bundles"/g)).toHaveLength(3);
    expect(sql.match(/UPDATE "bundle_translations"/g)).toHaveLength(3);
    expect(sql).not.toMatch(/^\s*(delete|drop|truncate|alter)\b/im);
    // every description fits the 200-character limit of /admin → Pricing
    for (const m of sql.matchAll(/E'([^']*)'/g)) expect(m[1].replace(/\\n/g, "\n").length).toBeLessThanOrEqual(200);
  });
});

describe("prop ideas on /book", () => {
  const base = { clientId: "client-0001", locale: "en", type: "date", bundleId: "our-little-story", babyCount: 1, slot: { date: "2026-12-01", start: "09:00" }, firstName: "Ana", mobile: "3055550142", email: "ana@example.com", zip: "33139", textConsent: true };
  test("optional, trimmed, at most 500 characters", () => {
    expect(requestSchema.parse(base).propIdeas).toBeUndefined();
    expect(requestSchema.parse({ ...base, propIdeas: "  A wicker basket  " }).propIdeas).toBe("A wicker basket");
    expect(requestSchema.safeParse({ ...base, propIdeas: "x".repeat(501) }).success).toBe(false);
  });

  test("migration 0049 only adds the column", () => {
    const sql = readFileSync("drizzle/0049_request_prop_ideas.sql", "utf8");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "prop_ideas" text/);
    expect(sql).not.toMatch(/^\s*(delete|drop|truncate|update)\b/im);
  });
});
