import { playsHere } from "./players";
import type { InspoItem } from "./types";

/**
 * Photos and videos are never mixed (owner, Nov 12: "the first row will only be pictures and the row below will be
 * only videos"): every list of shots (a section, a who-section) shows its photos, then its videos, then shot ideas
 * and other links (Pinterest…), each group on its own rows. The photo viewer follows the same order.
 */
export type ShotKind = "photo" | "video" | "other";

export const KIND_LABEL: Record<ShotKind, string> = { photo: "Photos", video: "Videos", other: "Ideas and links" };

export function kindOf(item: InspoItem): ShotKind {
  if ((item.type === "image" || item.type === "video") && item.mediaUrl) return "photo";
  if (item.type === "link" && playsHere(item.linkUrl)) return "video";
  return "other";
}

/** The non-empty groups, photos → videos → ideas and links, each in its saved order. */
export function byKind(items: InspoItem[]): { kind: ShotKind; items: InspoItem[] }[] {
  return (["photo", "video", "other"] as const).flatMap((kind) => {
    const group = items.filter((i) => kindOf(i) === kind);
    return group.length ? [{ kind, items: group }] : [];
  });
}

/** The same items in the order they're shown. */
export const inShownOrder = (items: InspoItem[]) => byKind(items).flatMap((g) => g.items);
