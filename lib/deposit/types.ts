import type { BookingResult } from "@/lib/booking/types";

/** The owner's deposits (/admin → Pricing & Promotions → Deposits): on/off + one amount per bundle. */
export interface DepositSettings {
  enabled: boolean;
  /** Bundle id → deposit (cents). A bundle without one uses DEFAULT_DEPOSIT_CENTS. */
  amounts: Record<string, number>;
  /** When the switch was last saved (ISO), for the Terms' "last updated" date. */
  updatedAt?: string;
}

/** A bundle's deposit until the owner sets its own. */
export const DEFAULT_DEPOSIT_CENTS = 5000;

/** How long a booking holds its time while the family is on the Stripe page (Stripe's minimum page life is 30 min). */
export const DEPOSIT_HOLD_MINUTES = 30;

/** A booking the owner made for a family (/admin → Quotes / Booking, owner Nov 12) holds its time this long for them. */
export const OWNER_HOLD_HOURS = 48;

/** Bookings the owner makes carry this request id prefix (set on the server; the family's link shows its two steps). */
export const OWNER_REQUEST_PREFIX = "owner-";
export const isOwnerBooked = (row: { requestId: string | null }) => Boolean(row.requestId?.startsWith(OWNER_REQUEST_PREFIX));

/**
 * When a payment page opened from a family's link closes: at the hold's end, but Stripe pages live 30 minutes to 24
 * hours, so within that (a minute of slack each side). Returns the page's end and the hold's end (pushed to the page's
 * end when the hold had less than 31 minutes left, so the page never outlives the hold).
 */
export function payPageWindow(holdUntil: Date, now = new Date()): { expiresAt: Date; holdUntil: Date } {
  const min = now.getTime() + 31 * 60_000;
  const max = now.getTime() + (24 * 60 - 1) * 60_000;
  const expiresAt = new Date(Math.min(Math.max(holdUntil.getTime(), min), max));
  return { expiresAt, holdUntil: expiresAt.getTime() > holdUntil.getTime() ? expiresAt : holdUntil };
}

export const depositAmountFor = (bundleId: string, s: Pick<DepositSettings, "amounts"> | null | undefined) => s?.amounts[bundleId] ?? DEFAULT_DEPOSIT_CENTS;

/** What a new booking pays while booking: its bundle's deposit, never more than its total. 0 = none (off, or a $0 booking). */
export const depositCentsFor = (totalCents: number, bundleId: string, s: DepositSettings | null | undefined) =>
  s?.enabled ? Math.max(0, Math.min(depositAmountFor(bundleId, s), totalCents)) : 0;

/**
 * How the website talks about deposits: the amount when every bookable bundle has the same one, else "from" the
 * smallest (`varies`). Null = off (or no bundles).
 */
export function depositLabel(s: DepositSettings | null | undefined, bundleIds: string[]): { cents: number; varies: boolean } | null {
  if (!s?.enabled || !bundleIds.length) return null;
  const amounts = bundleIds.map((id) => depositAmountFor(id, s));
  const cents = Math.min(...amounts);
  return { cents, varies: amounts.some((a) => a !== cents) };
}

/** See lib/db/schema.ts → booking_deposits. */
export type DepositStatus = "pending" | "paid" | "refunded" | "expired" | "unpaid";

/** A booking's deposit as the family's pages and emails show it. */
export interface BookingDepositInfo {
  amountCents: number;
  /** "paid", or "unpaid" when Stripe was down while booking (the studio sends a link). */
  status: "paid" | "unpaid";
}

/** GET /api/booking/deposit?bundle=…: what the booking form tells the family before they book. */
export interface DepositOffer {
  /** The bundle's deposit today (null = no deposit). The form shows min(this, total). */
  amountCents: number | null;
  /** Online cancel notice (hours): cancelling earlier refunds the deposit. */
  noticeHours: number;
}

/** GET /api/booking/deposit/status: the booking page after Stripe. */
export type DepositReturnState =
  | { state: "confirmed"; booking: BookingResult; requestId: string | null }
  /** Paid; the calendar event and emails are still being done (or retried). */
  | { state: "confirming" }
  /**
   * Not paid yet; the time is held until `holdUntil`. `ownerBooked`: the owner booked it for them, so the page asks for
   * their backdrops (`backdrops`: how many the bundle allows + what's picked) and then the deposit.
   */
  | {
      state: "waiting";
      amountCents: number;
      holdUntil: string | null;
      date: string;
      start: string;
      end: string;
      bundleName: string;
      payUrl: string | null;
      ownerBooked?: boolean;
      backdrops?: { allowed: number; picks: string[] };
    }
  /** Never paid: the time was released. */
  | { state: "expired"; date: string; start: string; bundleName: string }
  | { state: "invalid" };
