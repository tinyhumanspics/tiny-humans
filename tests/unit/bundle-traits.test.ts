import { describe, expect, test } from "vitest";
import { includesSiblings } from "@/lib/booking/bundle-traits";

describe("includesSiblings (the notes example only mentions siblings when they can join)", () => {
  test("live data: siblings listed as a feature, empty people line", () => {
    expect(includesSiblings({ people: "", features: ["Up to 3 hours", "Baby + parents + siblings", "3 setups"] })).toBe(true);
    expect(includesSiblings({ people: "", features: ["Up to 1 hour", "Baby only", "1 setup"] })).toBe(false);
  });
  test("people line and Spanish copy", () => {
    expect(includesSiblings({ people: "Baby + parents + siblings", features: [] })).toBe(true);
    expect(includesSiblings({ people: "", features: ["Bebé + padres + hermanos"] })).toBe(true);
    expect(includesSiblings({ people: "Solo bebé", features: ["Solo bebé"] })).toBe(false);
  });
});
