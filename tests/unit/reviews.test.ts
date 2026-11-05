import { describe, expect, test } from "vitest";
import { REVIEW_PREVIEW_CHARS, reviewPreview } from "@/lib/reviews/public";

describe("website review preview (\"Read more\")", () => {
  test("short reviews show whole", () => {
    expect(reviewPreview("We loved every minute. Alondra was so patient with our baby!")).toBeNull();
    // a few words over the limit are not worth a "Read more"
    expect(reviewPreview("a".repeat(REVIEW_PREVIEW_CHARS + 30))).toBeNull();
  });

  test("long reviews are cut after a whole word, with an ellipsis", () => {
    const body = `${"Such a calm and lovely session at home. ".repeat(12)}The end.`;
    const preview = reviewPreview(body);
    expect(preview).not.toBeNull();
    expect(preview!.endsWith("…")).toBe(true);
    expect(preview!.length).toBeLessThanOrEqual(REVIEW_PREVIEW_CHARS + 1);
    expect(body.startsWith(preview!.slice(0, -1))).toBe(true);
    // never ends mid-word or on punctuation before the ellipsis
    expect(preview).toMatch(/[A-Za-z]…$/);
  });

  test("Spanish punctuation is trimmed before the ellipsis", () => {
    const body = `${"¡Nos encantó la sesión, de verdad! ".repeat(10)}¿Volveremos? ¡Claro que sí!`;
    expect(reviewPreview(body)).toMatch(/[a-zá-úñ]…$/i);
  });

  test("one very long word is cut at the limit", () => {
    const preview = reviewPreview("x".repeat(REVIEW_PREVIEW_CHARS * 2));
    expect(preview).toBe(`${"x".repeat(REVIEW_PREVIEW_CHARS)}…`);
  });
});
