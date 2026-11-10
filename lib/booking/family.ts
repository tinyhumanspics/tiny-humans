import { isFamilyRole, MAX_FAMILY_MEMBERS, type FamilyRole } from "@/config/booking";
import type { Bundle } from "@/lib/pricing/types";
import { includesSiblings } from "./bundle-traits";

/**
 * Who else is in the photos (owner, Nov 10): on bundles that include the family (Our Family Story), the parent lists
 * up to MAX_FAMILY_MEMBERS people besides the baby or babies, each with a role and an optional name. Pure, client-safe.
 * Parent-typed names: never sent to Meta or analytics.
 */
export interface FamilyMember {
  role: FamilyRole;
  name?: string;
}

/** Studio-side words (owner emails, Outlook event, /admin); customers get theirs from messages/. */
export const OWNER_ROLES: Record<FamilyRole, string> = {
  mom: "Mom",
  dad: "Dad",
  sister: "Sister",
  brother: "Brother",
  grandma: "Grandma",
  grandpa: "Grandpa",
  aunt: "Aunt",
  uncle: "Uncle",
  cousin: "Cousin",
  other: "Family member",
};

/** The booking form asks who's joining on bundles whose "people" line or features include siblings (Our Family Story). */
export const asksFamily = (bundle: Pick<Bundle, "people" | "features">) => includesSiblings(bundle);

/** Whatever came in (request, database rows, saved drafts) → valid members, in order, at most MAX_FAMILY_MEMBERS. */
export function cleanFamily(list: unknown): FamilyMember[] {
  if (!Array.isArray(list)) return [];
  return list
    .flatMap((m): FamilyMember[] => {
      if (!m || typeof m !== "object" || !isFamilyRole((m as FamilyMember).role)) return [];
      const name = typeof (m as FamilyMember).name === "string" ? (m as FamilyMember).name!.trim().slice(0, 60) : "";
      return [{ role: (m as FamilyMember).role, ...(name ? { name } : {}) }];
    })
    .slice(0, MAX_FAMILY_MEMBERS);
}

/** "Mom (Ana)" / "Dad". `roles` = the words for each role (studio English by default). */
export function memberLabel(m: FamilyMember, roles: Record<FamilyRole, string> = OWNER_ROLES): string {
  const name = m.name?.trim();
  return name ? `${roles[m.role]} (${name})` : roles[m.role];
}

/** "Mom (Ana), Dad, Brother (Leo)"; "" when nobody is listed. */
export function familyLabel(members: FamilyMember[], roles: Record<FamilyRole, string> = OWNER_ROLES): string {
  return members.map((m) => memberLabel(m, roles)).join(", ");
}
