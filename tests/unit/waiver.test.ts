import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { childNames, familyLabel, sessionDayLabel, waiverFacts } from "@/lib/waiver/facts";
import { photosConsentOf, usesSummary, waiverSnapshot, waiverWords, WAIVER_VERSION } from "@/lib/waiver/text";
import { decodeSignature, signSchema, SIGNATURE_MAX_BYTES } from "@/lib/waiver/validation";

/** A PNG header (signature + IHDR) of the given size, padded to `bytes`: enough for the server's checks. */
function png(width: number, height: number, bytes = 200): string {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

const valid = {
  reference: "TH-20261103-4821",
  version: WAIVER_VERSION,
  language: "en",
  uses: { website: true, social: true, ads: false, bts: false, personal: false },
  firstNameOk: true,
  signerName: "Maria Morales",
  relationship: "parent",
  agree: true,
  signature: png(900, 300),
};

describe("photo waiver: the signature", () => {
  test("a small PNG of a sensible size is accepted", () => {
    expect(decodeSignature(png(900, 300))).toMatchObject({ width: 900, height: 300, bytes: 200 });
  });
  test("anything else is refused", () => {
    expect(decodeSignature(png(900, 300).replace("image/png", "image/jpeg"))).toBeNull();
    expect(decodeSignature("data:image/png;base64,iVBORw0K<script>")).toBeNull();
    expect(decodeSignature(`data:image/png;base64,${Buffer.from("GIF89a not a png at all, long enough to be checked").toString("base64")}`)).toBeNull();
    expect(decodeSignature(png(10, 10))).toBeNull();
    expect(decodeSignature(png(5000, 300))).toBeNull();
    expect(decodeSignature(png(900, 300, SIGNATURE_MAX_BYTES + 1))).toBeNull();
  });
});

describe("photo waiver: what Done sends", () => {
  test("a complete form passes", () => {
    expect(signSchema.safeParse(valid).success).toBe(true);
  });
  test("each missing piece is explained", () => {
    const issue = (over: object) => signSchema.safeParse({ ...valid, ...over }).error?.issues[0]?.message;
    expect(issue({ version: "old" })).toBe("This form was updated. Please close it and start again.");
    expect(issue({ agree: false })).toBe('Please tick "I agree".');
    expect(issue({ signerName: " M " })).toBe("Please write your full name.");
    expect(issue({ signature: png(10, 10) })).toBe("Please sign again.");
    expect(signSchema.safeParse({ ...valid, uses: { website: true } }).success).toBe(false);
    expect(signSchema.safeParse({ ...valid, notes: "anything else" }).success).toBe(false);
    expect(signSchema.safeParse({ ...valid, relationship: "aunt" }).success).toBe(false);
  });
});

describe("photo waiver: the words", () => {
  const ctx = { parentName: "Maria Morales", children: [{ name: "Sofia", age: "Newborn (0–2 weeks)" }], sessionDate: "2026-11-16" };

  test("the top line, in each language", () => {
    expect(waiverSnapshot("en", waiverFacts(ctx, "en")).facts).toBe("Your little one: Sofia · The Morales family · Mon, Nov 16");
    expect(familyLabel("Maria Morales", "es")).toBe("Familia Morales");
    expect(childNames([{ name: "Ava", age: "x" }, { name: "Mila", age: "x" }], "es")).toBe("Ava y Mila");
    expect(childNames([{ name: null, age: "x" }], "en")).toBeNull();
    expect(sessionDayLabel("2026-11-16", "es")).toMatch(/16/);
  });

  test("English and Spanish have the same parts; contact details are the studio's", () => {
    const en = waiverSnapshot("en", waiverFacts(ctx, "en"));
    const es = waiverSnapshot("es", waiverFacts(ctx, "es"));
    expect(Object.keys(es)).toEqual(Object.keys(en));
    expect(es.uses.map((u) => u.key)).toEqual(en.uses.map((u) => u.key));
    expect(es.promises).toHaveLength(en.promises.length);
    expect(en.promises[2]).toContain("(786) 222-7194");
    expect(en.promises[2]).toContain("hello@tinyhumans.photography");
    expect(es.firstName?.label).toBe("Está bien usar el primer nombre de Sofia en los textos");
  });

  test("no baby name: no first-name question", () => {
    expect(waiverSnapshot("en", waiverFacts({ ...ctx, children: [{ name: null, age: "x" }] }, "en")).firstName).toBeNull();
  });

  test("the same booking always gives the same text (its fingerprint is stable)", () => {
    const a = JSON.stringify(waiverSnapshot("en", waiverFacts(ctx, "en")));
    const b = JSON.stringify(waiverSnapshot("en", waiverFacts(ctx, "en")));
    expect(a).toBe(b);
  });

  test("v1's wording is pinned: changing it needs a new WAIVER_VERSION", () => {
    // If this fails because the wording changed on purpose: bump WAIVER_VERSION in lib/waiver/text.ts, then update
    // the fingerprint here. Older signatures keep the text they were signed with either way.
    const words = JSON.stringify([waiverWords("en"), waiverWords("es")]);
    expect(WAIVER_VERSION).toBe("Photo and video release v1 (draft, Nov 2026)");
    expect(createHash("sha256").update(words).digest("hex").slice(0, 16)).toMatchInlineSnapshot(`"672ea1811c54a76e"`);
  });

  test("Photo use on the lead and the owner summary", () => {
    expect(photosConsentOf({ website: false, social: true })).toBe(true);
    expect(photosConsentOf({ ads: true, bts: true })).toBe(false);
    expect(usesSummary({ website: true, ads: true })).toBe("Website, Ads");
    expect(usesSummary({})).toBe("None: keep photos private");
  });
});
