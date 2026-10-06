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

/** Where the studio comes to (every session is at the family's home). */
export interface SessionAddress {
  street: string;
  city: string;
  zip: string;
}

export interface BookingRequest {
  bundleId: string;
  address: SessionAddress;
  slot: TimeSlot;
  contact: BookingContact;
  /** Portfolio photo id the family wants their session to look like. */
  inspirationPhotoId?: string;
  /** Same value for retries of one submission, so double-clicks can't double-book. */
  requestId?: string;
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
  /** Prototype/mock only: lets the preview open the cancel page. Never set for real bookings. */
  preview?: { cancelToken: string };
}

/** What the cancel page may show (no contact details, no address). */
export interface CancellationSummary {
  reference: string;
  bundleName: string;
  date: DateKey;
  start: string;
  end: string;
  parentFirstName: string;
  /** "active" = can be cancelled. */
  status: "active" | "cancelled" | "past";
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
}

/** Used by the booking form in the browser. */
export interface BookingClient {
  readonly name: string;
  getAvailability(query: AvailabilityQuery): Promise<DayAvailability[]>;
  createBooking(request: BookingRequest): Promise<BookingResult>;
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
