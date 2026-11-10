import type { BringLists, BringSection, ShootDetail } from "./types";

/**
 * Day sheet ticks. Every tickable line has a key, saved per Miami day in `shoot_ticks` (spec §4):
 * - an inspo / BTS card:          `inspo:<inspo id>`
 * - a "What we always bring" item: `bring:<date>:<section id>:<hash of the item>`
 * - a backdrop:                    `bring:<date>:bd:<shoot key>:<backdrop id>`
 * - a family's extra / add-on:     `bring:<date>:<shoot key>:<hash>`
 * The shoot key is stable ("b-<reference>" for bookings), and item keys come from the item's text, so renaming an
 * item un-ticks it while reordering keeps the tick.
 */

/** djb2 over the text (trimmed, case and spacing ignored), base 36: short, stable and the same in the browser. */
export function hashText(text: string): string {
  const t = text.trim().replace(/\s+/g, " ").toLowerCase();
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const inspoKey = (inspoId: string) => `inspo:${inspoId}`;
export const sectionItemKey = (date: string, sectionId: string, text: string) => `bring:${date}:${sectionId}:${hashText(text)}`;
export const backdropKey = (date: string, shootKey: string, backdropId: string) => `bring:${date}:bd:${shootKey}:${backdropId}`;
export const extraKey = (date: string, shootKey: string, text: string) => `bring:${date}:${shootKey}:${hashText(text)}`;
export const addonKey = (date: string, shootKey: string, name: string) => extraKey(date, shootKey, `addon:${name}`);

/** Keys the API accepts (anything else is refused before it reaches the database). */
export const TICK_KEY = /^(inspo:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|bring:\d{4}-\d{2}-\d{2}:[A-Za-z0-9_-]{1,64}(:[A-Za-z0-9_-]{1,64}){1,2})$/;

type BringShoot = Pick<ShootDetail, "key" | "tabLabel" | "booking" | "bringExtra">;

/**
 * "What to bring" for a day: each family's backdrops, their booked add-ons + "Bring extra", then every section from
 * What we always bring that has items, in order.
 */
export function bringLists(date: string, shoots: BringShoot[], sections: BringSection[]): BringLists {
  const backdrops = shoots.flatMap((s) =>
    (s.booking?.backdrops ?? []).map((b) => ({ key: backdropKey(date, s.key, b.id), text: `${b.name} backdrop`, who: s.tabLabel, color: b.color })),
  );
  const extras = shoots.flatMap((s) => [
    ...(s.booking?.addons ?? []).map((a) => ({
      key: addonKey(date, s.key, a.name),
      text: `${a.name}${a.quantity > 1 ? ` ×${a.quantity}` : ""} (booked add-on)`,
      who: s.tabLabel,
    })),
    ...s.bringExtra.map((text) => ({ key: extraKey(date, s.key, text), text, who: s.tabLabel })),
  ]);
  const listed = [...sections]
    .sort((a, b) => a.sort - b.sort)
    .filter((sec) => sec.items.length)
    .map((sec) => ({ id: sec.id, name: sec.name.trim() || "Untitled section", items: sec.items.map((text) => ({ key: sectionItemKey(date, sec.id, text), text })) }));
  return { backdrops, extras, sections: listed };
}

/** Every tickable key on a day: each card of each shoot, then What to bring. */
export function dayKeys(date: string, shoots: (BringShoot & Pick<ShootDetail, "inspo">)[], sections: BringSection[]): string[] {
  const bring = bringLists(date, shoots, sections);
  const keys = [
    ...shoots.flatMap((s) => s.inspo.map((i) => inspoKey(i.id))),
    ...bring.backdrops.map((b) => b.key),
    ...bring.extras.map((b) => b.key),
    ...bring.sections.flatMap((s) => s.items.map((i) => i.key)),
  ];
  return [...new Set(keys)];
}

/** How many of a day's keys are ticked (ticks for lines that no longer exist don't count). */
export function progressOf(keys: string[], ticked: Iterable<string>): { ticked: number; total: number } {
  const on = new Set(ticked);
  return { ticked: keys.filter((k) => on.has(k)).length, total: keys.length };
}
