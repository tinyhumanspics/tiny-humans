/**
 * "What we always bring": the starting sections (the template's draft, owner Nov 9: "the owners edit them on What we
 * always bring"). Migration 0024 inserts exactly these; after that the owners add, rename, fill and remove sections
 * in /admin. tests/unit/shoots.test.ts keeps drizzle/0024_shoots.sql equal to this list.
 */
export interface BringSectionDraft {
  name: string;
  items: string[];
}

export const DEFAULT_BRING_SECTIONS: readonly BringSectionDraft[] = [
  {
    name: "Studio kit",
    items: [
      "Backdrop stand + clamps",
      "Posing beanbag + spare covers and layers",
      "Posing pillows and wedges",
      "Space heater",
      "White noise machine",
      "Wraps, bonnets and outfits",
      "Puppy pads, wipes, hand sanitizer",
      "Extension cord",
      "Step stool",
    ],
  },
  {
    name: "Camera gear",
    items: [
      "Camera + 2 charged batteries",
      "2 empty memory cards + 1 spare",
      "50 mm lens",
      "35 mm lens (family shots)",
      "Macro lens (details)",
      "Light + softbox",
      "Reflector",
      "Tripod",
      "Phone + small tripod for the BTS clips",
      "Power bank",
    ],
  },
  {
    name: "Wardrobe (Adri and Alo)",
    items: [
      "Neutral clothes, no big logos (you're in the clips)",
      "Soft fabrics, nothing scratchy (you'll hold baby)",
      "No perfume or cologne",
      "Clean socks, indoor shoes",
      "Jewelry off while posing baby",
      "Hair tied back",
    ],
  },
];

/** Limits for owner-typed lists (also enforced by lib/shoots/validation.ts). */
export const LIST_LIMITS = { sections: 30, items: 80, itemLength: 200, nameLength: 80 } as const;

/** One item per line: trimmed, blank lines dropped, duplicates kept once (a tick key is per item text). */
export function linesOf(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/\s+/g, " ");
    if (!line || seen.has(line.toLowerCase())) continue;
    seen.add(line.toLowerCase());
    out.push(line);
  }
  return out;
}
