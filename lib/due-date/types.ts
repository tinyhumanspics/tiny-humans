/**
 * "Not born yet" (owner, Nov 10): a family reserves a bundle with their due date, paying the deposit when deposits
 * are on. When the baby is born, they (their schedule link) or the owner (/admin → Leads → Due dates) pick the session:
 * it becomes a normal booking with the kept price and no new deposit. Client-safe types and pure helpers.
 */

/** How far ahead a due date can be: 9 months from the day they reserve (owner, Nov 10). */
export const DUE_WINDOW_MONTHS = 9;

export type DueStatus = "pending" | "reserved" | "scheduling" | "scheduled" | "cancelled" | "expired";
export type DueDepositStatus = "none" | "pending" | "paid" | "unpaid" | "refunded" | "expired";

/** "2026-11-10" + 9 months = "2027-08-10" (the last day of a shorter month when the day doesn't exist). */
export function addMonthsToKey(key: string, months: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** The due dates a family can pick today: from today through 9 months ahead. */
export const dueWindow = (today: string) => ({ from: today, to: addMonthsToKey(today, DUE_WINDOW_MONTHS) });

/** What the family's schedule link shows (and fills in) on the booking form. */
export interface DueSummary {
  reference: string;
  bundleId: string;
  bundleName: string;
  dueDate: string;
  babyCount: number;
  /** The bundle price kept for them (the special offer when one ran the day they reserved). */
  bundlePriceCents: number;
  regularPriceCents: number;
  offerLabel: string | null;
  /** The deposit already paid (0 = none). */
  depositPaidCents: number;
  /** Backdrops picked while reserving (the booking form starts with them); [] = not sure yet. */
  backdrops?: string[];
  /** The discount code they entered (applied to their session when they book). */
  discountCode?: string | null;
  contact: { parentName: string; email: string; phone: string; street: string; unit: string; city: string; zip: string };
}

/** /admin → Leads → Due dates: one reservation. */
export interface DueReservationRow {
  id: string;
  reference: string;
  status: DueStatus;
  depositStatus: DueDepositStatus;
  depositCents: number;
  bundleId: string;
  bundleName: string;
  bundlePriceCents: number;
  regularPriceCents: number;
  offerLabel: string | null;
  babyCount: number;
  dueDate: string;
  parentName: string;
  email: string;
  phone: string;
  locale: "en" | "es";
  address: string;
  zip: string;
  notes: string | null;
  travelFeeCents: number | null;
  travelMiles: number | null;
  createdAt: string;
  /** The booking made from it (once scheduled). */
  booking: { reference: string; date: string; start: string } | null;
  /** The family's link to pick their session (works while it's reserved). */
  scheduleUrl: string | null;
  /** Backdrops picked while reserving ([] = not sure yet). */
  backdrops: string[];
  /** Discount code entered while reserving and what it takes off the bundle (null = none). */
  discount: { code: string; offCents: number } | null;
}

/** POST /api/due-date answer: reserved now (no deposit), or the Stripe page for the deposit. */
export interface DueCreateResult {
  reference: string;
  status: "reserved" | "pending";
  depositUrl?: string;
  /** The signed "Your spot is reserved" page (no deposit to pay). */
  donePath?: string;
}
