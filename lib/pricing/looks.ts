/**
 * A bundle's looks (owner, Nov 24), written in its description in /admin → Pricing, one per line: first how many
 * ("2 looks"), then each look ("Little Nest: a second backdrop with a prop, like a basket or tiny bed"). The name before
 * the colon shows in bold. A one-line description is just one line.
 */
export interface BundleLooks {
  /** "2 looks" / "2 estilos"; null when the description is a single line. */
  title: string | null;
  items: { name: string | null; text: string }[];
}

/** A name before a colon, if it's short enough to be one ("Cozy Wrap"); otherwise the line has no name. */
const NAME_MAX = 40;

export function looksOf(description?: string | null): BundleLooks | null {
  const lines = (description ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const [first, ...rest] = lines;
  const title = rest.length && !first.includes(":") ? first : null;
  const items = (title ? rest : lines).map((line) => {
    const at = line.indexOf(":");
    return at > 0 && at <= NAME_MAX ? { name: line.slice(0, at).trim(), text: line.slice(at + 1).trim() } : { name: null, text: line };
  });
  return { title, items };
}

/** The feature line that counts setups or looks ("2 setups", "1 look", "3 escenarios"): the looks replace it on screen. */
const COUNT_LINE = /^\s*\d+\s*(?:looks?|set-?ups?|montajes?|escenarios?|estilos?)\b/i;
export const isLooksCount = (feature: string) => COUNT_LINE.test(feature);

/** The bundle's features as shown next to its looks: the count line is left out ("drop") or says the looks' title ("swap"). */
export function featuresWithLooks(features: string[], looks: BundleLooks | null, mode: "drop" | "swap"): string[] {
  if (!looks?.title) return features;
  return mode === "drop" ? features.filter((f) => !isLooksCount(f)) : features.map((f) => (isLooksCount(f) ? looks.title! : f));
}
