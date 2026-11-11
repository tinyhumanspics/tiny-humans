import type { FamilyRole } from "@/config/booking";
import type { FamilyMember } from "@/lib/booking/family";
import type { WaiverFacts, WaiverKind, WaiverLanguage } from "./text";
import type { WaiverChild } from "./types";

/** The line at the top of the release ("Sofia · The Morales family · Mon, Nov 16"), in the signing language. Pure. */

const SUFFIXES = /^(jr|sr|ii|iii|iv)\.?$/i;

/** "Maria Morales" → "Morales" (a single name stays as typed). */
export function lastNameOf(parentName: string): string {
  const words = parentName.trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && SUFFIXES.test(words.at(-1)!)) words.pop();
  return words.at(-1) ?? "";
}

/** "The Morales family" / "Familia Morales". */
export function familyLabel(parentName: string, lang: WaiverLanguage): string {
  const last = lastNameOf(parentName) || parentName.trim();
  return lang === "es" ? `Familia ${last}` : `The ${last} family`;
}

/** "Sofia", "Ava and Mila" / "Ava y Mila"; null when no baby has a name. */
export function childNames(children: WaiverChild[], lang: WaiverLanguage): string | null {
  const names = children.map((c) => c.name?.trim()).filter((n): n is string => Boolean(n));
  if (!names.length) return null;
  const and = lang === "es" ? "y" : "and";
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} ${and} ${names.at(-1)}`;
}

/** "Mon, Nov 16" / "lun, 16 nov" from "YYYY-MM-DD" (no time zone shift). */
export function sessionDayLabel(date: string, lang: WaiverLanguage): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** The family words of the release (same as the customer emails' `emails.common.roles`). */
const ROLES: Record<WaiverLanguage, Record<FamilyRole, string>> = {
  en: { mom: "Mom", dad: "Dad", sister: "Sister", brother: "Brother", grandma: "Grandma", grandpa: "Grandpa", aunt: "Aunt", uncle: "Uncle", cousin: "Cousin", other: "Family member" },
  es: { mom: "Mamá", dad: "Papá", sister: "Hermana", brother: "Hermano", grandma: "Abuela", grandpa: "Abuelo", aunt: "Tía", uncle: "Tío", cousin: "Primo o prima", other: "Familiar" },
};

/** "Maria (Mom), Leo (Brother)" / "Mamá, Leo (Hermano)"; null when the parent listed nobody. */
export function everyoneLine(family: FamilyMember[], lang: WaiverLanguage): string | null {
  if (!family.length) return null;
  return family.map((m) => (m.name?.trim() ? `${m.name.trim()} (${ROLES[lang][m.role]})` : ROLES[lang][m.role])).join(", ");
}

const joinNames = (names: string[], lang: WaiverLanguage) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} ${lang === "es" ? "y" : "and"} ${names.at(-1)}`);

export function waiverFacts(ctx: { parentName: string; children: WaiverChild[]; sessionDate: string; kind?: WaiverKind; family?: FamilyMember[] }, lang: WaiverLanguage): WaiverFacts {
  const base = { familyName: familyLabel(ctx.parentName, lang), babyNames: childNames(ctx.children, lang), dateLabel: sessionDayLabel(ctx.sessionDate, lang) };
  if (ctx.kind !== "family") return base;
  const family = ctx.family ?? [];
  const names = [...ctx.children.map((c) => c.name?.trim()), ...family.map((m) => m.name?.trim())].filter((n): n is string => Boolean(n));
  return { ...base, everyone: everyoneLine(family, lang), firstNames: names.length ? joinNames(names, lang) : null };
}
