/**
 * Booking domain types + provider contracts.
 *
 * - BookingClient: what the website's booking form uses.
 * - BookingProvider: the full server-side contract (adds cancel/reschedule).
 *
 * Providers: MockBookingProvider (prototype / BOOKING_PROVIDER=mock) and
 * OutlookBookingProvider (BOOKING_PROVIDER=outlook: Outlook Calendar +
 * Outlook email via Microsoft Graph, bookings stored in Neon).
 */

import type { PriceQuote } from "@/lib/pricing/engine";
import type { Attribution } from "@/lib/tracking/attribution";
import type { BookingTravel } from "@/lib/travel/types";
import type { AppLocale } from "@/i18n/config";
import type { BookingBaby } from "./extra-babies";
export type { BookingBaby } from "./extra-babies";
export type { PriceQuote };

/** Calendar date in the studio's time zone, formatted YYYY-MM-DD. */
export type DateKey = string;

export interface TimeSlot {
  id: string;
  date: DateKey;
  /** 24h local time, "HH:MM". */
  start: string;
  end: string;
  /** Display label, e.g. "10:30 am". */
  label: string;
}

export interface DayAvailability {
  date: DateKey;
  slots: TimeSlot[];
}

export interface AvailabilityQuery {
  bundleId: string;
  /** Babies in the session; changes the slot length for twins/triplets. */
  babyCount?: number;
  /** Inclusive range. */
  from: DateKey;
  to: DateKey;
}

export interface BookingContact {
  parentName: string;
  email: string;
  phone: string;
  babyName?: string;
  babyAge: string;
  notes?: string;
}

/** Optional permissions given at booking (never sent to Meta or analytics). */
export interface BookingConsents {
  /** "OK to text me about my session (reminders, arrival updates). Reply STOP anytime." */
  sms: boolean;
  /** "OK to feature our photos on the Tiny Humans website and social media." */
  photos: boolean;
}

/** Where the studio comes to (every session is at the family's home). */
export interface SessionAddress {
  street: string;
  /** Apartment / unit (Miami condos), part of the address line. */
  unit?: string;
  city: string;
  zip: string;
  /** Gate code, parking, concierge: studio calendar, /admin and the 24-hour reminder only (never on public pages). */
  accessNotes?: string;
}

export interface BookingRequest {
  bundleId: string;
  /** Customer-facing language used for this booking and its later emails. */
  locale?: AppLocale;
  /** Every baby in the session. Older clients omit this and use the first baby in `contact`. */
  babies?: BookingBaby[];
  address: SessionAddress;
  slot: TimeSlot;
  contact: BookingContact;
  /** Portfolio photo id the family wants their session to look like. */
  inspirationPhotoId?: string;
  /** Same value for retries of one submission, so double-clicks can't double-book. */
  requestId?: string;
  /** Optional discount code (validated + priced on the server). */
  discountCode?: string;
  /** Optional permissions (unticked = no). */
  consents?: BookingConsents;
  /** Optional backdrop picks (ids from config/backdrops.ts, one per setup). */
  backdrops?: string[];
  /** Spam signals (never stored): hidden honeypot field + how long the booking form was open. */
  hp?: string;
  elapsedMs?: number;
  /** Booking source (set on the server from the first-party cookie, never by the browser). */
  attribution?: Attribution;
}

export interface BookingResult {
  /** Booking reference shown to the family, e.g. TH-20261005-4821. */
  id: string;
  /** "mock" means nothing was written to a real calendar. */
  status: "mock" | "confirmed" | "pending";
  request: BookingRequest;
  createdAt: string;
  /** Whether the confirmation email went out (real bookings only). */
  emailSent?: boolean;
  /** The price actually booked (server-calculated snapshot). */
  pricing?: PriceQuote;
  /** Travel fee on top of the bundle (server-calculated from the ZIP code). */
  travel?: BookingTravel;
  /** Owner's current "customer reschedule notice" (hours), for the policy line on the confirmation page. */
  rescheduleNoticeHours?: number;
  /** Prototype/mock only: lets the preview open the cancel page. Never set for real bookings. */
  preview?: { cancelToken: string };
  /**
   * The deposit. status "pending" (with `status: "pending"` on the result): not booked yet, the family pays on `url`
   * (Stripe) and comes back to `returnPath`; the time is held until `holdUntil`. "unpaid": Stripe was down, so it was
   * booked without it.
   */
  deposit?: { amountCents: number; status: "paid" | "unpaid" | "pending"; url?: string; returnPath?: string; holdUntil?: string };
}

/** What the cancel page may show (no contact details, no address). */
export interface CancellationSummary {
  reference: string;
  bundleId: string;
  bundleName: string;
  date: DateKey;
  start: string;
  end: string;
  parentFirstName: string;
  /** "active" = not cancelled and not started. */
  status: "active" | "cancelled" | "past";
  /** False inside the booking's notice window (or cancelled/past): the family texts instead. */
  canCancel: boolean;
  /** The booking's online cancel/reschedule notice. */
  noticeHours: number;
}

/** What the reschedule page shows (the token holder's own booking). */
export interface ManagedBooking {
  reference: string;
  bundleId: string;
  bundleName: string;
  date: DateKey;
  start: string;
  end: string;
  location: string;
  parentFirstName: string;
  status: "active" | "cancelled" | "past";
  /** False when inside the reschedule notice window (or cancelled/past). */
  canReschedule: boolean;
  rescheduleNoticeHours: number;
}

export interface CancelOptions {
  reason: string;
  by: "customer" | "admin";
  /** Skip customer/internal emails (used by admin "Delete Lead"). */
  silent?: boolean;
  /** Refund the paid deposit (online cancellation by the family: always; the owner chooses in /admin). */
  refundDeposit?: boolean;
}

/** Used by the booking form in the browser. */
export interface BookingClient {
  readonly name: string;
  getAvailability(query: AvailabilityQuery): Promise<DayAvailability[]>;
  createBooking(request: BookingRequest): Promise<BookingResult>;
  /** Price for a bundle (optionally with a code). Always calculated server-side for real bookings. */
  quote(bundleId: string, code?: string, email?: string, babyCount?: number): Promise<PriceQuote>;
  /** Customer cancel link: look up the booking behind a token. */
  getCancellation(token: string): Promise<CancellationSummary>;
  /** Customer cancel link: cancel with a required reason. */
  cancelWithToken(token: string, reason: string): Promise<CancellationSummary>;
  /** Customer reschedule link: the booking behind the token. */
  getManagedBooking(token: string): Promise<ManagedBooking>;
  /** Customer reschedule link: open times (the booking's own slot doesn't block itself). */
  getRescheduleAvailability(token: string, from: DateKey, to: DateKey): Promise<DayAvailability[]>;
  /** Customer reschedule link: move to a new date/time (rechecked on the server). */
  rescheduleWithToken(token: string, slot: { date: DateKey; start: string }): Promise<ManagedBooking>;
}

/** Full server-side contract. */
export interface BookingProvider extends BookingClient {
  cancelBooking(reference: string, opts?: CancelOptions): Promise<void>;
  rescheduleBooking(reference: string, slot: Pick<TimeSlot, "date" | "start">): Promise<BookingResult>;
}
