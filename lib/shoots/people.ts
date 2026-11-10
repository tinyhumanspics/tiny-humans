import { OWNER_ROLES } from "@/lib/booking/family";
import type { InspoItem, ShootBookingFacts } from "./types";

/**
 * Who's in each shot (owner, Nov 10: twins → each baby and both; family shoots → everyone, the parents, dad and
 * brother…). A booking's people are its babies ("baby:0", …) then its listed family ("fam:0", …); a shot idea keeps
 * the keys of the people in it, or "all" for everyone together. Pure, so it's unit tested.
 */
export const WHO_ALL = "all";
const KEY = /^(all|baby:[0-2]|fam:[0-4])$/;
export const isWhoKey = (k: string) => KEY.test(k);

export interface ShootPerson {
  key: string;
  /** "Ava", "Baby 2", "Mom", "Brother (Leo)" */
  label: string;
  kind: "baby" | "family";
  /** Babies: "Girl · Newborn (0–2 weeks)"; family: their role when a name is shown. */
  detail: string | null;
}

const GENDER: Record<string, string> = { boy: "Boy", girl: "Girl" };

/** Everyone a booking lists, babies first. Two people with the same label get a number ("Mom", "Mom 2"). */
export function peopleOf(facts: Pick<ShootBookingFacts, "babies" | "family"> | null): ShootPerson[] {
  if (!facts) return [];
  const many = facts.babies.length > 1;
  const people: ShootPerson[] = [
    ...facts.babies.map((b, i) => ({
      key: `baby:${i}`,
      label: b.name || (many ? `Baby ${i + 1}` : "Baby"),
      kind: "baby" as const,
      detail: [b.gender ? GENDER[b.gender] : null, b.age].filter(Boolean).join(" · ") || null,
    })),
    ...(facts.family ?? []).map((m, i) => ({
      key: `fam:${i}`,
      label: m.name ? `${OWNER_ROLES[m.role]} (${m.name})` : OWNER_ROLES[m.role],
      kind: "family" as const,
      detail: null,
    })),
  ];
  const seen = new Map<string, number>();
  return people.map((p) => {
    const n = (seen.get(p.label) ?? 0) + 1;
    seen.set(p.label, n);
    return n > 1 ? { ...p, label: `${p.label} ${n}` } : p;
  });
}

/** The "who's in it" picker only makes sense with more than one person. */
export const picksWho = (people: ShootPerson[]) => people.length > 1;

/** Keys as saved: known people only, in the booking's order, no repeats; "all" stands alone. */
export function cleanWho(keys: readonly string[], people: ShootPerson[]): string[] {
  if (keys.includes(WHO_ALL)) return [WHO_ALL];
  const order = new Map(people.map((p, i) => [p.key, i]));
  return [...new Set(keys)].filter((k) => order.has(k)).sort((a, b) => order.get(a)! - order.get(b)!);
}

/** Tap a chip: "Everyone" replaces the rest; a person replaces "Everyone"; tapping again removes. */
export function toggleWho(keys: readonly string[], key: string, people: ShootPerson[]): string[] {
  if (key === WHO_ALL) return keys.includes(WHO_ALL) ? [] : [WHO_ALL];
  const rest = keys.filter((k) => k !== WHO_ALL);
  return cleanWho(rest.includes(key) ? rest.filter((k) => k !== key) : [...rest, key], people);
}

const joinAnd = (labels: string[]) => (labels.length > 1 ? `${labels.slice(0, -1).join(", ")} & ${labels.at(-1)}` : (labels[0] ?? ""));

/** "Everyone", "Ava & Mia", "Mom, Dad & Brother (Leo)"; "" when nobody is picked. */
export function whoLabel(keys: readonly string[], people: ShootPerson[]): string {
  const clean = cleanWho(keys, people);
  if (clean[0] === WHO_ALL) return "Everyone together";
  const byKey = new Map(people.map((p) => [p.key, p.label]));
  return joinAnd(clean.map((k) => byKey.get(k)!));
}

export interface WhoGroup {
  /** "all", "baby:0,baby:1", … or "" for shots nobody is picked for yet. */
  key: string;
  label: string;
  /** A single person's details (a baby's gender and age) under the heading. */
  detail: string | null;
  items: InspoItem[];
}

/**
 * The day sheet's sections: everyone together first, then bigger groups before smaller ones, then each person in the
 * booking's order, and "Not picked yet" last. Each shot keeps its order inside its section.
 */
export function groupByWho(items: InspoItem[], people: ShootPerson[]): WhoGroup[] {
  const order = new Map(people.map((p, i) => [p.key, i]));
  const groups = new Map<string, WhoGroup>();
  for (const item of items) {
    const keys = cleanWho(item.who ?? [], people);
    const key = keys.join(",");
    if (!groups.has(key)) {
      const single = keys.length === 1 && keys[0] !== WHO_ALL ? people.find((p) => p.key === keys[0]) : undefined;
      groups.set(key, { key, label: key ? whoLabel(keys, people) : "Not picked yet", detail: single?.detail ?? null, items: [] });
    }
    groups.get(key)!.items.push(item);
  }
  const rank = (g: WhoGroup) => {
    if (!g.key) return [3, 0, 0];
    if (g.key === WHO_ALL) return [0, 0, 0];
    const keys = g.key.split(",");
    return [keys.length > 1 ? 1 : 2, -keys.length, order.get(keys[0]) ?? 0];
  };
  return [...groups.values()].sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
}
