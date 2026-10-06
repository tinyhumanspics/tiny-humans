/**
 * Transactional email templates. Add new templates (reminders, mini-session
 * announcements, ...) under ./templates, composing the blocks in ./layout.
 */
export { bookingConfirmationEmail } from "./templates/booking-confirmation";
export { bookingCancellationEmail } from "./templates/booking-cancellation";
export { bookingRescheduledEmail } from "./templates/booking-rescheduled";
export { internalNewBookingEmail, internalCancellationEmail, internalRescheduleEmail } from "./templates/internal";
export type { RenderedEmail, EmailAttachment, ImageMode } from "./types";
