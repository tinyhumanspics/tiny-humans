/**
 * Transactional emails (React Email templates in /emails, rendered to HTML + plain text, sent with Resend).
 * Add new templates (reminders, after-session emails, ...) in /emails, composing emails/components.
 */
export { bookingConfirmationEmail } from "@/emails/BookingConfirmation";
export { bookingCancellationEmail } from "@/emails/BookingCancellation";
export { bookingRescheduledEmail } from "@/emails/BookingRescheduled";
export { internalNewBookingEmail, internalCancellationEmail, internalRescheduleEmail, internalNewReviewEmail } from "@/emails/Internal";
export type { RenderedEmail, EmailAttachment, ImageMode } from "./types";
export type { EmailLocale } from "./messages";
export { sessionReminderEmail, type ReminderKind } from "@/emails/SessionReminder";
export { sneakPeekEmail } from "@/emails/AfterSession";
export { galleryDeliveredEmail } from "@/emails/GalleryDelivered";
export { paymentLinkEmail } from "@/emails/PaymentLink";
