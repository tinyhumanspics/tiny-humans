/**
 * Database schema (Neon PostgreSQL, via Drizzle ORM).
 * Change this file, then run `npm run db:generate` to create a migration.
 */
import { sql } from "drizzle-orm";
import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const bookingStatus = pgEnum("booking_status", ["pending", "confirmed", "rescheduled", "cancelled"]);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-friendly reference, e.g. TH-20261005-4821. */
    bookingReference: text("booking_reference").notNull().unique(),
    /** Same value for retries of one submission (prevents duplicate bookings). */
    requestId: text("request_id").unique(),

    packageId: text("package_id").notNull(),
    packageName: text("package_name").notNull(),
    /** Whole US dollars, taken from config/bundles.ts on the server (never from the browser). */
    packagePrice: integer("package_price").notNull(),

    parentName: text("parent_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    babyName: text("baby_name"),
    babyAge: text("baby_age").notNull(),

    /** Every session is at the family's home today; kept flexible for the future. */
    locationType: text("location_type").notNull().default("client_home"),
    locationAddress: text("location_address").notNull(),

    /** Local date of the session (studio time zone). */
    sessionDate: date("session_date", { mode: "string" }).notNull(),
    sessionStart: timestamp("session_start", { withTimezone: true }).notNull(),
    sessionEnd: timestamp("session_end", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),

    notes: text("notes"),
    inspirationPhotoId: text("inspiration_photo_id"),

    status: bookingStatus("status").notNull().default("pending"),

    outlookEventId: text("outlook_event_id"),
    outlookCalendarUser: text("outlook_calendar_user"),

    confirmationEmailSent: boolean("confirmation_email_sent").notNull().default(false),
    confirmationEmailSentAt: timestamp("confirmation_email_sent_at", { withTimezone: true }),
    /** Short reason if the confirmation email failed (no secrets). */
    confirmationEmailError: text("confirmation_email_error"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Only one active booking can start at a given moment (last line of defense against double booking).
    uniqueIndex("bookings_active_start_idx").on(t.sessionStart).where(sql`status <> 'cancelled'`),
    index("bookings_session_date_idx").on(t.sessionDate),
    index("bookings_status_idx").on(t.status),
    index("bookings_email_idx").on(t.email),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
