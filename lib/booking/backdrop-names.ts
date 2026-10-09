import en from "@/messages/en.json";
import { BACKDROPS } from "@/config/backdrops";

const names: Record<string, string> = en.emails.backdrops.names;

export const backdropName = (id: string, localizedNames: Record<string, string> = names) => localizedNames[id] ?? id;

/** Human-readable names in the backdrop list's display order (English by default). */
export function backdropNames(ids: readonly string[], localizedNames: Record<string, string> = names, conjunction = "and"): string {
  const list = BACKDROPS.filter((b) => ids.includes(b.id)).map((b) => backdropName(b.id, localizedNames));
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} ${conjunction} ${list[list.length - 1]}`;
}
