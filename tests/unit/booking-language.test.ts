import { describe, expect, test } from "vitest";
import { setupsOf } from "@/config/backdrops";
import { consumeBookingLanguageDraft, saveBookingLanguageDraft } from "@/lib/booking/language-draft";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("localized booking details", () => {
  test("allows one backdrop per setup in English and Spanish", () => {
    expect(setupsOf(["1 setup"])).toBe(1);
    expect(setupsOf(["2 setups"])).toBe(2);
    expect(setupsOf(["1 montaje"])).toBe(1);
    expect(setupsOf(["2 montajes"])).toBe(2);
    expect(setupsOf(["5 montajes"])).toBe(3);
  });

  test("moves a booking draft only to its matching translated route", () => {
    const storage = memoryStorage();
    const payload = { step: 2, parentName: "Test Parent" };
    saveBookingLanguageDraft(storage, "/es/book", "our-little-story", payload, 1_000);

    expect(consumeBookingLanguageDraft(storage, "/book", "our-little-story", 1_001)).toBeNull();
    expect(consumeBookingLanguageDraft(storage, "/es/book", "our-little-story", 1_001)).toBeNull();
  });

  test("restores a fresh matching draft once and rejects expired drafts", () => {
    const storage = memoryStorage();
    const payload = { step: 3, backdrops: ["cream", "wooden"] };
    saveBookingLanguageDraft(storage, "/es/book", "our-little-story", payload, 10_000);
    expect(consumeBookingLanguageDraft(storage, "/es/book", "our-little-story", 10_500)).toEqual(payload);
    expect(consumeBookingLanguageDraft(storage, "/es/book", "our-little-story", 10_501)).toBeNull();

    saveBookingLanguageDraft(storage, "/es/book", "our-little-story", payload, 10_000);
    expect(consumeBookingLanguageDraft(storage, "/es/book", "our-little-story", 130_001)).toBeNull();
  });
});
