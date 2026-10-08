import en from "@/messages/en.json";
import { BACKDROPS } from "@/config/backdrops";

const names: Record<string, string> = en.emails.backdrops.names;

export const backdropName = (id: string) => names[id] ?? id;

/** Human-readable English names in the backdrop list's display order. */
export function backdropNames(ids: readonly string[]): string {
  const list = BACKDROPS.filter((b) => ids.includes(b.id)).map((b) => backdropName(b.id));
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}
