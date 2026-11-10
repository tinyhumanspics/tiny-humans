/** /admin → Shoots: what the owner pages and API routes exchange (spec: docs/shoots/SHOOTS-SPEC.md). */

export type ShootKind = "booking" | "styled";
export type InspoGroup = "inspo" | "bts";
export type InspoType = "image" | "video" | "link" | "note";

/** Bookings that become shoots (cancelled ones never show on a day sheet; a folder can still be opened). */
export type ShootBookingStatus = "pending" | "confirmed" | "rescheduled" | "cancelled";

/** One inspo or BTS idea. `mediaUrl`: the photo/video to show (owner-only); `linkUrl`: the pasted link. */
export interface InspoItem {
  id: string;
  group: InspoGroup;
  type: InspoType;
  mediaUrl: string | null;
  contentType: string | null;
  width: number | null;
  height: number | null;
  linkUrl: string | null;
  platform: string | null;
  /** "What's the shot?" / "What's the idea?" */
  caption: string;
  sort: number;
}

export interface ShootBaby {
  name: string | null;
  age: string;
}

export interface ShootBackdrop {
  id: string;
  name: string;
  color: string;
}

export interface ShootAddon {
  name: string;
  quantity: number;
  extraMinutes: number;
}

export interface ShootDeposit {
  status: "pending" | "paid" | "refunded" | "expired" | "unpaid";
  amountCents: number;
}

/** Everything a booking feeds into its shoot (spec §3), from the booking's own snapshot. */
export interface ShootBookingFacts {
  bookingId: string;
  reference: string;
  status: ShootBookingStatus;
  /** Miami day "YYYY-MM-DD" and "HH:MM" (24 h) in the booking's time zone. */
  date: string;
  start: string;
  end: string;
  durationMinutes: number;
  parentName: string;
  /** "The Morales family" / "Morales" until the owners rename them. */
  defaultTitle: string;
  defaultTabLabel: string;
  bundleName: string;
  /** Backdrops the bundle allows (its setups, 1–3). */
  backdropsAllowed: number;
  /** Who can be in the photos, as booked (e.g. "Baby + parents + siblings"); null when the bundle doesn't say. */
  people: string | null;
  siblings: boolean;
  babies: ShootBaby[];
  backdrops: ShootBackdrop[];
  addons: ShootAddon[];
  /** The site photo they picked while booking. */
  pick: { id: string; title: string; src: string } | null;
  /** The booking's notes: the starting text of "What the family asked for". */
  notes: string | null;
  address: string;
  city: string;
  mapUrl: string;
  deposit: ShootDeposit | null;
}

/** A shoot on a list or a day card. `key` is stable: "b-<reference>" for bookings, the row id otherwise. */
export interface ShootSummary {
  key: string;
  /** The shoots row id (null for a booking nobody has edited yet). */
  id: string | null;
  kind: ShootKind;
  date: string;
  start: string | null;
  end: string | null;
  title: string;
  tabLabel: string;
  /** "Our Little Story · 2 h · 2 backdrops"; null for shoots without a booking. */
  bundleLine: string | null;
  /** City for bookings, the typed place otherwise. */
  place: string | null;
  inspoCount: number;
  btsCount: number;
  status: ShootBookingStatus | null;
}

/** A shoot's folder (and one family on the day sheet). */
export interface ShootDetail extends ShootSummary {
  booking: ShootBookingFacts | null;
  /** "Inspo for Sofia" / "Inspo for the set". */
  inspoTitle: string;
  /** "Sofia, newborn (0–2 weeks)" / "No baby: just the set". */
  whoLine: string;
  said: string;
  /** True while "What the family asked for" still shows the booking's notes (never edited). */
  saidFromBooking: boolean;
  confirm: string[];
  /** Lines the booking adds by itself (e.g. backdrops not picked yet). */
  autoConfirm: string[];
  bringExtra: string[];
  inspo: InspoItem[];
}

export interface BringSection {
  id: string;
  name: string;
  items: string[];
  sort: number;
}

/** One line on "What to bring", with its tick key. */
export interface BringLine {
  key: string;
  text: string;
  /** Tab label of the family it's for (backdrops, extras). */
  who?: string;
  color?: string;
}

export interface BringLists {
  backdrops: BringLine[];
  extras: BringLine[];
  sections: { id: string; name: string; items: BringLine[] }[];
}

export interface ShootDay {
  date: string;
  /** "HH:MM" (24 h, Miami), null if the sun doesn't set (never in Florida). */
  sunset: string | null;
  shoots: ShootSummary[];
  ticked: number;
  total: number;
}

export interface DaySheet {
  date: string;
  sunset: string | null;
  shoots: ShootDetail[];
  bring: BringLists;
  /** Ticked keys on this day. */
  ticks: string[];
  ticked: number;
  total: number;
}
