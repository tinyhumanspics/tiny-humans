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
}

/** Used by the booking form in the browser. */
export interface BookingClient {
  readonly name: string;
  getAvailability(query: AvailabilityQuery): Promise<DayAvailability[]>;
  createBooking(request: BookingRequest): Promise<BookingResult>;
}

/** Full server-side contract. */
export interface BookingProvider extends BookingClient {
  cancelBooking(reference: string): Promise<void>;
  rescheduleBooking(reference: string, slot: Pick<TimeSlot, "date" | "start">): Promise<BookingResult>;
}
