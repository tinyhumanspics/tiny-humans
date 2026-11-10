import type { WaiverFacts, WaiverLanguage } from "./text";
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

export function waiverFacts(ctx: { parentName: string; children: WaiverChild[]; sessionDate: string }, lang: WaiverLanguage): WaiverFacts {
  return { familyName: familyLabel(ctx.parentName, lang), babyNames: childNames(ctx.children, lang), dateLabel: sessionDayLabel(ctx.sessionDate, lang) };
}
