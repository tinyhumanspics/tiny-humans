/**
 * Database schema (Neon PostgreSQL, via Drizzle ORM).
 * Change this file, then run `npm run db:generate` to create a migration.
 */
import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgEnum, pgTable, smallint, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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

    /** Internal "new booking" notification to Tiny Humans (sent with Resend). */
    internalNotificationSent: boolean("internal_notification_sent").notNull().default(false),
    internalNotificationSentAt: timestamp("internal_notification_sent_at", { withTimezone: true }),
    internalNotificationError: text("internal_notification_error"),

    /* cancellation (customer link or admin) — the booking row is kept as history */
    cancellationReason: text("cancellation_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by"),
    /** SHA-256 of the customer's booking-management token (cancel + reschedule links). The token itself is never stored. */
    cancelTokenHash: text("cancel_token_hash").unique(),
    cancellationEmailSent: boolean("cancellation_email_sent").notNull().default(false),
    cancellationEmailSentAt: timestamp("cancellation_email_sent_at", { withTimezone: true }),
    cancellationEmailError: text("cancellation_email_error"),
    internalCancellationSent: boolean("internal_cancellation_sent").notNull().default(false),
    internalCancellationSentAt: timestamp("internal_cancellation_sent_at", { withTimezone: true }),
    internalCancellationError: text("internal_cancellation_error"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Only one active booking can start at a given moment (last line of defense against double booking).
    uniqueIndex("bookings_active_start_idx").on(t.sessionStart).where(sql`status <> 'cancelled'`),
    index("bookings_session_date_idx").on(t.sessionDate),
    index("bookings_status_idx").on(t.status),
    index("bookings_email_idx").on(t.email),
    index("bookings_created_at_idx").on(t.createdAt),
    check("bookings_cancelled_by_check", sql`${t.cancelledBy} is null or ${t.cancelledBy} in ('customer', 'admin')`),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

/* ---------------- owner-managed availability (/admin > Availability) ---------------- */

/** Weekly schedule: one row per weekday (0 = Sunday ... 6 = Saturday). */
export const availabilityWeekly = pgTable(
  "availability_weekly",
  {
    weekday: smallint("weekday").primaryKey(),
    isOpen: boolean("is_open").notNull().default(false),
    startTime: time("start_time").notNull().default("09:00"),
    endTime: time("end_time").notNull().default("18:00"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("availability_weekly_weekday_check", sql`${t.weekday} between 0 and 6`),
    check("availability_weekly_hours_check", sql`${t.endTime} > ${t.startTime}`),
  ],
);

/** Booking rules: a single row (id = 1). */
export const bookingSettingsTable = pgTable(
  "booking_settings",
  {
    id: smallint("id").primaryKey().default(1),
    minimumNoticeDays: integer("minimum_notice_days").notNull().default(1),
    bookingWindowDays: integer("booking_window_days").notNull().default(90),
    bufferMinutes: integer("buffer_minutes").notNull().default(45),
    /** Customers can reschedule online until this many hours before the session. */
    customerRescheduleNoticeHours: integer("customer_reschedule_notice_hours").notNull().default(48),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("booking_settings_single_row", sql`${t.id} = 1`),
    check("booking_settings_notice_check", sql`${t.minimumNoticeDays} between 0 and 60`),
    check("booking_settings_window_check", sql`${t.bookingWindowDays} between 1 and 365`),
    check("booking_settings_buffer_check", sql`${t.bufferMinutes} between 0 and 240`),
    check("booking_settings_reschedule_notice_check", sql`${t.customerRescheduleNoticeHours} between 0 and 336`),
  ],
);

/** Special dates: closed all day, or custom hours replacing the weekly schedule. */
export const availabilityOverrides = pgTable(
  "availability_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date", { mode: "string" }).notNull().unique(),
    isClosed: boolean("is_closed").notNull().default(true),
    startTime: time("start_time"),
    endTime: time("end_time"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "availability_overrides_hours_check",
      sql`${t.isClosed} or (${t.startTime} is not null and ${t.endTime} is not null and ${t.endTime} > ${t.startTime})`,
    ),
  ],
);

/** Manual time blocks (e.g. a personal appointment). */
export const availabilityBlocks = pgTable(
  "availability_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date", { mode: "string" }).notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("availability_blocks_date_idx").on(t.date), check("availability_blocks_hours_check", sql`${t.endTime} > ${t.startTime}`)],
);

/** Every reschedule appends a row (full history; never overwritten). */
export const bookingRescheduleHistory = pgTable(
  "booking_reschedule_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    oldSessionStart: timestamp("old_session_start", { withTimezone: true }).notNull(),
    oldSessionEnd: timestamp("old_session_end", { withTimezone: true }).notNull(),
    newSessionStart: timestamp("new_session_start", { withTimezone: true }).notNull(),
    newSessionEnd: timestamp("new_session_end", { withTimezone: true }).notNull(),
    rescheduledBy: text("rescheduled_by").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("booking_reschedule_history_booking_idx").on(t.bookingId, t.createdAt),
    check("booking_reschedule_history_by_check", sql`${t.rescheduledBy} in ('customer', 'admin')`),
  ],
);
