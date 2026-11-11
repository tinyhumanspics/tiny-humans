/**
 * Discount code categories (owner, Nov 10): which campaign a code belongs to, e.g. a Thanksgiving code that families
 * use while the website still shows the Original theme. An owner-only label: never shown to customers and never part
 * of a price. Pure, so it's unit tested.
 */
export const CODE_CATEGORY_PRESETS = ["Thanksgiving offer", "Christmas offer", "Happy Valentine's offer"] as const;
export const MAX_CODE_CATEGORY_LENGTH = 60;
/** The filter value for codes without a category. */
export const NO_CATEGORY = "__none__";

/** Trimmed, single spaces, at most 60 characters; empty = no category. */
export function cleanCodeCategory(value: string | null | undefined): string | null {
  const v = (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CODE_CATEGORY_LENGTH).trim();
  return v || null;
}

/** The editor's choices: the presets first, then the owner's own categories already on codes (A–Z, no repeats). */
export function codeCategoryOptions(used: (string | null | undefined)[]): string[] {
  const seen = new Set<string>(CODE_CATEGORY_PRESETS.map((p) => p.toLowerCase()));
  const own: string[] = [];
  for (const u of used) {
    const c = cleanCodeCategory(u);
    if (c && !seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase());
      own.push(c);
    }
  }
  return [...CODE_CATEGORY_PRESETS, ...own.sort((a, b) => a.localeCompare(b))];
}

/** The codes list filter: "" = every code, NO_CATEGORY = codes without one, otherwise that category (any case). */
export function filterByCategory<T extends { category: string | null }>(codes: T[], filter: string): T[] {
  if (!filter) return codes;
  if (filter === NO_CATEGORY) return codes.filter((c) => !c.category);
  return codes.filter((c) => c.category?.toLowerCase() === filter.toLowerCase());
}
