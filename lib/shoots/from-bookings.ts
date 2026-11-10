import { BACKDROPS, setupsOf } from "@/config/backdrops";
import { includesSiblings } from "@/lib/booking/bundle-traits";
import en from "@/messages/en.json";
import { mapsHref } from "./links";
import { familyLabel, type FamilyMember } from "@/lib/booking/family";
import type { ShootAddon, ShootBaby, ShootBookingFacts, ShootBookingStatus, ShootDeposit } from "./types";

/**
 * The Tiny Humans adapter: a booking (its own snapshot + extras) → what its shoot shows (spec §3). The only Shoots
 * file that knows about bookings, with `booking-source.ts` (which loads them); pure, so it's unit tested.
 */
export interface BookingSource {
  id: string;
  reference: string;
  status: ShootBookingStatus;
  parentName: string;
  sessionDate: string;
  sessionStart: Date;
  sessionEnd: Date;
  timezone: string;
  packageName: string;
  /** What the bundle included when booked ("Up to 2 hours", "Baby only", "2 setups", …). */
  packageInclusions: string[] | null;
  babyName: string | null;
  babyAge: string;
  /** booking_babies rows (twins/triplets); empty for older bookings, which only have the first baby. */
  babies: { name?: string | null; age: string; gender?: "boy" | "girl" | null }[];
  /** booking_family_members rows (bundles that include the family). */
  family: FamilyMember[];
  backdropPicks: string[];
  addons: ShootAddon[];
  pick: { id: string; title: string; src: string } | null;
  notes: string | null;
  address: string;
  city: string;
  deposit: ShootDeposit | null;
}

/** A booking reference as it appears in shoot keys and folder links ("b-TH-20261103-4821"). */
export const BOOKING_KEY = /^b-(TH-\d{8}-\d{4})$/;
export const bookingKeyOf = (reference: string) => `b-${reference}`;
export const referenceOfKey = (key: string) => key.match(BOOKING_KEY)?.[1] ?? null;

const SUFFIXES = /^(jr|sr|ii|iii|iv)\.?$/i;

/** "Maria Morales" → "Morales"; "Ana María López Jr." → "López"; a single name stays as typed. */
export function familyNameOf(parentName: string): string {
  const words = parentName.trim().replace(/[,;]+$/, "").split(/\s+/).filter(Boolean);
  while (words.length > 1 && SUFFIXES.test(words.at(-1)!)) words.pop();
  return words.at(-1) ?? "";
}

/** Default title + tab label: "The Morales family" / "Morales" ("Maria's family" for a single name). */
export function familyTitles(parentName: string): { title: string; tabLabel: string } {
  const name = familyNameOf(parentName);
  if (!name) return { title: "The family", tabLabel: "Family" };
  const single = parentName.trim().split(/\s+/).length === 1;
  return { title: single ? `${name}'s family` : `The ${name} family`, tabLabel: name };
}

const local = (d: Date, timeZone: string) => new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/** "2 h", "1 h 30 min", "45 min". */
export function hoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ") || "0 min";
}

/** The line of the booked bundle that says who's in the photos ("Baby only", "Baby + parents + siblings"). */
export function peopleOf(inclusions: string[]): string | null {
  return inclusions.find((line) => /\bbaby only\b|parents?\b|siblings?\b|\bfamily\b|solo (el )?beb|padres|herman/i.test(line))?.trim() || null;
}

const backdropName = (id: string) => (en.emails.backdrops.names as Record<string, string>)[id] ?? id;

/** A booking → its shoot facts. Babies: booking_babies when saved, else the first baby on the booking. */
export function bookingFacts(b: BookingSource): ShootBookingFacts {
  const inclusions = b.packageInclusions ?? [];
  const { title, tabLabel } = familyTitles(b.parentName);
  const babies: ShootBaby[] = b.babies.length
    ? b.babies.map((x) => ({ name: x.name?.trim() || null, age: x.age, gender: x.gender ?? null }))
    : [{ name: b.babyName?.trim() || null, age: b.babyAge, gender: null }];
  const known = new Map<string, (typeof BACKDROPS)[number]>(BACKDROPS.map((x) => [x.id, x]));
  const backdrops = b.backdropPicks.flatMap((id) => {
    const bd = known.get(id);
    return bd ? [{ id: bd.id, name: backdropName(bd.id), color: bd.color }] : [];
  });
  return {
    bookingId: b.id,
    reference: b.reference,
    status: b.status,
    date: b.sessionDate,
    start: local(b.sessionStart, b.timezone),
    end: local(b.sessionEnd, b.timezone),
    durationMinutes: Math.max(0, Math.round((b.sessionEnd.getTime() - b.sessionStart.getTime()) / 60_000)),
    parentName: b.parentName,
    defaultTitle: title,
    defaultTabLabel: tabLabel,
    bundleName: b.packageName,
    backdropsAllowed: setupsOf(inclusions),
    people: peopleOf(inclusions),
    siblings: includesSiblings({ people: "", features: inclusions }),
    babies,
    family: b.family,
    backdrops,
    addons: b.addons,
    pick: b.pick,
    notes: b.notes?.trim() || null,
    address: b.address,
    city: b.city,
    mapUrl: mapsHref(b.address),
    deposit: b.deposit,
  };
}

/** "Our Little Story · 2 h · 2 backdrops" */
export function bundleLine(f: Pick<ShootBookingFacts, "bundleName" | "durationMinutes" | "backdropsAllowed">): string {
  return [f.bundleName, hoursLabel(f.durationMinutes), `${f.backdropsAllowed} ${f.backdropsAllowed === 1 ? "backdrop" : "backdrops"}`].join(" · ");
}

const joinNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? ""));

/** Baby names for headings ("Sofia", "Ava and Mila"), "the baby"/"the babies" when no name was given. */
export function babyNamesOf(babies: ShootBaby[]): string {
  const names = babies.map((b) => b.name).filter((n): n is string => Boolean(n));
  return names.length === babies.length && names.length ? joinNames(names) : babies.length > 1 ? "the babies" : "the baby";
}

/** "Inspo for Sofia" / "Inspo for Ava and Mila" / "Inspo for the set". */
export function inspoTitleOf(facts: Pick<ShootBookingFacts, "babies"> | null): string {
  return facts ? `Inspo for ${babyNamesOf(facts.babies)}` : "Inspo for the set";
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Who's on camera: "Sofia, newborn (0–2 weeks)", twins joined with "and", then the family as listed
 * (", with Mom, Dad, Brother (Leo)") or, when the bundle includes them but nobody was listed, ", with parents and siblings".
 */
export function whoLineOf(facts: (Pick<ShootBookingFacts, "babies" | "siblings"> & { family?: FamilyMember[] }) | null): string {
  if (!facts) return "No baby: just the set";
  const babies = facts.babies.map((b, i) => `${b.name || (facts.babies.length > 1 ? `Baby ${i + 1}` : "Baby")}, ${lowerFirst(b.age)}`);
  const family = facts.family?.length ? `, with ${familyLabel(facts.family)}` : facts.siblings ? ", with parents and siblings" : "";
  return joinNames(babies) + family;
}

/** Lines the booking adds to "Still to confirm" by itself: backdrops the family hasn't picked yet. */
export function autoConfirmOf(facts: Pick<ShootBookingFacts, "backdrops" | "backdropsAllowed"> | null): string[] {
  if (!facts || facts.backdrops.length >= facts.backdropsAllowed) return [];
  return [`Backdrops: ${facts.backdrops.length} of ${facts.backdropsAllowed} picked. The family picks the rest on their backdrop page.`];
}
