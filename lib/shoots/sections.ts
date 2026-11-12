import type { InspoGroup, InspoItem, ShootSection } from "./types";

/**
 * The owner's own sections inside a shoot's Inspo and BTS (owner, Nov 12: "Inspo for David · Section 2", e.g. another
 * outfit on the same set, or phone videos vs a Reel). Pure: the folder and the day sheet both split a group's items
 * with this. The main section (id null) keeps the group's own title; an item whose section is gone shows there.
 */

export const MAX_SECTIONS_PER_GROUP = 12;
export const SECTION_NAME_MAX = 80;

export interface SectionBlock {
  /** null = the group's main section ("Inspo for David" / "BTS on phones"). */
  id: string | null;
  title: string;
  items: InspoItem[];
}

/** The main title of a group. */
export const groupTitle = (group: InspoGroup, inspoTitle: string) => (group === "inspo" ? inspoTitle : "BTS on phones");

/** The group's sections in order. */
export const sectionsIn = (sections: ShootSection[], group: InspoGroup) =>
  sections.filter((s) => s.group === group).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

/** Main section first, then the owner's sections, each with its items (saved order). */
export function sectionBlocks(group: InspoGroup, items: InspoItem[], sections: ShootSection[], inspoTitle: string): SectionBlock[] {
  const own = sectionsIn(sections, group);
  const known = new Set(own.map((s) => s.id));
  const mine = items.filter((i) => i.group === group);
  return [
    { id: null, title: groupTitle(group, inspoTitle), items: mine.filter((i) => !i.sectionId || !known.has(i.sectionId)) },
    ...own.map((s) => ({ id: s.id, title: s.name, items: mine.filter((i) => i.sectionId === s.id) })),
  ];
}

/** A new section's starting name: "Inspo for David · Section 2", then 3, 4… (skips names already used). */
export function newSectionName(group: InspoGroup, sections: ShootSection[], inspoTitle: string): string {
  const base = groupTitle(group, inspoTitle);
  const used = new Set(sectionsIn(sections, group).map((s) => s.name.trim().toLowerCase()));
  for (let n = 2; ; n += 1) {
    const name = `${base} · Section ${n}`.slice(0, SECTION_NAME_MAX);
    if (!used.has(name.toLowerCase())) return name;
  }
}
