import { describe, expect, test } from "vitest";
import { themes } from "@/config/themes";

/** WCAG 2.x contrast ratio of two #rrggbb colors. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `color-mix(in srgb, a p, b)` for opaque colors. */
function mix(a: string, b: string, p: number): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [ca, cb] = [channels(a), channels(b)];
  return `#${ca.map((v, i) => Math.round(v * p + cb[i] * (1 - p)).toString(16).padStart(2, "0")).join("")}`;
}

describe("theme text contrast on the chalkboard (WCAG 1.4.3, 4.5:1)", () => {
  for (const theme of Object.values(themes)) {
    const c = theme.colors;
    test(`${theme.label}: body text colors`, () => {
      for (const [name, color] of Object.entries({ chalkWhite: c.chalkWhite, sunYellow: c.sunYellow, chalkMuted: c.chalkMuted, cloudBlue: c.cloudBlue, chalkError: c.chalkError })) {
        expect(contrast(color, c.chalkboard), name).toBeGreaterThanOrEqual(4.5);
      }
    });
    test(`${theme.label}: seasonal cutoff line (accent 2 lightened 60/40 with chalk white)`, () => {
      expect(contrast(mix(c.accent2, c.chalkWhite, 0.6), c.chalkboard)).toBeGreaterThanOrEqual(4.5);
    });
    test(`${theme.label}: form hints (60% chalk white on the field) and empty rating stars (50%, 3:1)`, () => {
      const field = mix(c.chalkboardDark, c.chalkboard, 0.6);
      expect(contrast(mix(c.chalkWhite, field, 0.6), field)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mix(c.chalkWhite, c.chalkboard, 0.5), c.chalkboard)).toBeGreaterThanOrEqual(3);
    });
  }
});
