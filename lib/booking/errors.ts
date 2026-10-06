/**
 * Errors the booking system shows to families. `message` is always safe to
 * display; internal details are logged server-side, never sent to the browser.
 */
export type BookingErrorCode =
  | "invalid_request"
  | "slot_unavailable"
  | "not_found"
  | "not_configured"
  | "calendar_unavailable"
  | "reschedule_closed"
  | "server_error";

const STATUS: Record<BookingErrorCode, number> = {
  invalid_request: 400,
  slot_unavailable: 409,
  not_found: 404,
  not_configured: 503,
  calendar_unavailable: 502,
  reschedule_closed: 403,
  server_error: 500,
};

export class BookingError extends Error {
  readonly code: BookingErrorCode;
  readonly status: number;
  constructor(code: BookingErrorCode, message: string) {
    super(message);
    this.name = "BookingError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export const friendly = {
  slotTaken: "That time was just booked. Please pick another time.",
  rescheduleTaken: "That time was just booked. Please choose another available time.",
  calendar: "We couldn't reach our calendar just now. Please try again in a minute.",
  server: "Something went wrong saving your booking. Please try again, or email hello@tinyhumans.photography.",
  notConfigured: "Online booking isn't available right now. Please email hello@tinyhumans.photography to book.",
};
