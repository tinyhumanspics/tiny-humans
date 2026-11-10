import { describe, expect, test } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * The travel fee numbers (free miles, price per mile, farthest distance) live in /admin → Availability → Travel fee.
 * Every customer text that mentions them must take them from there ({free}, {perMile}, {max}, {miles}, …), never as
 * typed numbers, so one save in /admin changes the FAQ, the Terms, the booking form and the emails together
 * (owner, Nov 9: "whenever I change it, it changes on everything else that is attached to it").
 */
const texts = (node: unknown, path = ""): [string, string][] =>
  typeof node === "string"
    ? [[path, node]]
    : node && typeof node === "object"
      ? Object.entries(node).flatMap(([k, v]) => texts(v, path ? `${path}.${k}` : k))
      : [];

// a typed number (or $ amount) right before "mile(s)" / "milla(s)", or "$… a mile / por milla"
const typedDistance = /(\$\s*\d|\b\d[\d,.]*)\s*(?:road\s+)?(?:miles?|millas?)\b/i;
const typedPerMile = /\$\s*\d[\d,.]*\s*(?:a|per|each|por(?: cada)?)\s+(?:extra\s+)?(?:mile|milla)/i;

describe("travel fee wording follows /admin", () => {
  for (const [lang, messages] of [["en", en], ["es", es]] as const) {
    test(`${lang}: no typed miles or per-mile prices`, () => {
      const offenders = texts(messages).filter(([, t]) => typedDistance.test(t) || typedPerMile.test(t));
      expect(offenders).toEqual([]);
    });
  }

  test("the FAQ and the Terms fill in all three numbers", () => {
    for (const m of [en, es]) {
      const faq = m.landing.faq.items.find((i) => "aFee" in i) as { aFee: string } | undefined;
      expect(faq?.aFee).toMatch(/\{max\}/);
      expect(faq?.aFee).toMatch(/\{free\}/);
      expect(faq?.aFee).toMatch(/\{perMile\}/);
      expect(m.legal.dynamic.travelFee).toMatch(/\{freeMiles\}/);
      expect(m.legal.dynamic.travelFee).toMatch(/\{maxMiles\}/);
      expect(m.legal.dynamic.travelFee).toMatch(/\{perMile\}/);
    }
  });

  test("the check catches a typed number", () => {
    expect(typedDistance.test("The first 30 miles are free")).toBe(true);
    expect(typedPerMile.test("after that it's $1 a mile")).toBe(true);
    expect(typedDistance.test("Las primeras 30 millas son gratis")).toBe(true);
    expect(typedDistance.test("The first {free} miles are free")).toBe(false);
  });
});
