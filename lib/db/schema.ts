/**
 * Database schema (Neon PostgreSQL, via Drizzle ORM).
 * Change this file, then run `npm run db:generate` to create a migration.
 */
import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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

    /* price snapshot at booking time (never recalculated from current bundles) */
    regularPriceCents: integer("regular_price_cents"),
    offerPriceCents: integer("offer_price_cents"),
    offerLabel: text("offer_label"),
    discountCode: text("discount_code"),
    discountAmountCents: integer("discount_amount_cents"),
    finalPriceCents: integer("final_price_cents"),
    pricingType: text("pricing_type"),
    /** What the bundle included when it was booked. */
    packageInclusions: jsonb("package_inclusions").$type<string[]>(),

    /* booking source: first touch of the visit (utm tags, Meta click id, landing page, referring site origin) */
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    fbclid: text("fbclid"),
    landingPath: text("landing_path"),
    referrer: text("referrer"),
    firstTouchAt: timestamp("first_touch_at", { withTimezone: true }),

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
    check("bookings_pricing_type_check", sql`${t.pricingType} is null or ${t.pricingType} in ('regular', 'offer', 'discount')`),
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

/**
 * Scheduled customer emails (session reminders now; after-session emails later). One row per booking, kind and
 * session time: inserting the row claims the email, so it can never be sent twice, and a reschedule (new session
 * time) makes the booking due again. Failures stay visible in /admin.
 */
export const bookingEmails = pgTable(
  "booking_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    /** "reminder_72h" | "reminder_24h" | "after_session" | "gallery_delivered" */
    kind: text("kind").notNull(),
    /** The session time this email was about. */
    sessionStart: timestamp("session_start", { withTimezone: true }).notNull(),
    /** "sending" | "sent" | "failed" */
    status: text("status").notNull().default("sending"),
    attempts: integer("attempts").notNull().default(1),
    resendId: text("resend_id"),
    /** Short reason if sending failed (no secrets). */
    error: text("error"),
    /** SHA-256 of the manage-link token in this email. Valid only while the booking keeps this session time. */
    linkTokenHash: text("link_token_hash").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("booking_emails_once_idx").on(t.bookingId, t.kind, t.sessionStart),
    check("booking_emails_status_check", sql`${t.status} in ('sending', 'sent', 'failed')`),
  ],
);

export type BookingEmail = typeof bookingEmails.$inferSelect;

/**
 * Card payment after the session (Stripe Checkout, exact booked amount). One row per booking: the latest Checkout
 * Session the family opened, and whether it's paid (Stripe webhook, or checked when the family opens the link again).
 */
export const bookingPayments = pgTable(
  "booking_payments",
  {
    bookingId: uuid("booking_id").primaryKey().references(() => bookings.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    /** "open" (payment page created) | "paid" */
    status: text("status").notNull().default("open"),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntent: text("stripe_payment_intent"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("booking_payments_status_check", sql`${t.status} in ('open', 'paid')`)],
);

export type BookingPayment = typeof bookingPayments.$inferSelect;

/**
 * Optional permissions from the booking form (texts about the session; featuring the photos on the website and social
 * media), with when each was given or changed. A separate table so a missing migration can never break bookings.
 */
export const bookingConsents = pgTable("booking_consents", {
  bookingId: uuid("booking_id").primaryKey().references(() => bookings.id, { onDelete: "cascade" }),
  sms: boolean("sms").notNull().default(false),
  smsAt: timestamp("sms_at", { withTimezone: true }),
  photos: boolean("photos").notNull().default(false),
  photosAt: timestamp("photos_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BookingConsent = typeof bookingConsents.$inferSelect;

/**
 * What each booking was promised when it was made, so later changes in /admin only affect new bookings:
 * the online cancel/reschedule notice (hours) and how many edited photos the bundle included (e.g. "20").
 */
export const bookingTerms = pgTable("booking_terms", {
  bookingId: uuid("booking_id").primaryKey().references(() => bookings.id, { onDelete: "cascade" }),
  noticeHours: integer("notice_hours").notNull(),
  photosLabel: text("photos_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BookingTerm = typeof bookingTerms.$inferSelect;

/**
 * How to get in, from the booking form (gate code, parking, concierge), for the studio's calendar, /admin and the
 * 24-hour reminder. The unit number is part of `bookings.location_address`. A separate table so a missing migration
 * can never break bookings.
 */
export const bookingAccess = pgTable("booking_access", {
  bookingId: uuid("booking_id").primaryKey().references(() => bookings.id, { onDelete: "cascade" }),
  notes: text("notes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BookingAccess = typeof bookingAccess.$inferSelect;

/** A family's review of their session (from the link in the gallery email). The owner picks which to use publicly. */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").notNull().unique().references(() => bookings.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    body: text("body").notNull(),
    /** Name the family chose to show with the review, e.g. "Ana M." */
    displayName: text("display_name").notNull(),
    /** The family's OK to show the review on the website. */
    consentPublic: boolean("consent_public").notNull().default(false),
    /** Owner's pick for the website (only possible with the family's OK). */
    approved: boolean("approved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("reviews_rating_check", sql`${t.rating} between 1 and 5`)],
);

export type Review = typeof reviews.$inferSelect;

/* ---------------- pricing & promotions (/admin/pricing) ---------------- */

export const bundlesTable = pgTable(
  "bundles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    regularPriceCents: integer("regular_price_cents").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    durationLabel: text("duration_label"),
    photosLabel: text("photos_label"),
    badge: text("badge"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    offerEnabled: boolean("offer_enabled").notNull().default(false),
    offerPriceCents: integer("offer_price_cents"),
    offerLabel: text("offer_label"),
    offerEndsOn: date("offer_ends_on", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("bundles_price_check", sql`${t.regularPriceCents} >= 0`),
    check("bundles_duration_check", sql`${t.durationMinutes} between 15 and 480`),
    check("bundles_offer_check", sql`${t.offerPriceCents} is null or (${t.offerPriceCents} >= 0 and ${t.offerPriceCents} < ${t.regularPriceCents})`),
  ],
);

export const bundleInclusions = pgTable(
  "bundle_inclusions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bundleId: text("bundle_id").notNull().references(() => bundlesTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [index("bundle_inclusions_bundle_idx").on(t.bundleId, t.position)],
);

export const discountCodes = pgTable(
  "discount_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stored uppercase; matched case-insensitively. */
    code: text("code").notNull().unique(),
    discountType: text("discount_type").notNull(),
    /** percent: 1-100; fixed: cents */
    discountValue: integer("discount_value").notNull(),
    active: boolean("active").notNull().default(true),
    expiresOn: date("expires_on", { mode: "string" }),
    maxUses: integer("max_uses"),
    onePerEmail: boolean("one_per_email").notNull().default(false),
    internalNote: text("internal_note"),
    usesCount: integer("uses_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("discount_codes_type_check", sql`${t.discountType} in ('percent', 'fixed')`),
    check("discount_codes_value_check", sql`${t.discountValue} > 0 and (${t.discountType} <> 'percent' or ${t.discountValue} <= 100)`),
    check("discount_codes_max_uses_check", sql`${t.maxUses} is null or ${t.maxUses} > 0`),
  ],
);

export const discountCodeBundles = pgTable(
  "discount_code_bundles",
  {
    codeId: uuid("code_id").notNull().references(() => discountCodes.id, { onDelete: "cascade" }),
    bundleId: text("bundle_id").notNull().references(() => bundlesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.codeId, t.bundleId] })],
);

export const discountCodeUsage = pgTable(
  "discount_code_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeId: uuid("code_id").notNull().references(() => discountCodes.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    /** lower(email) when the code is one-per-email, else null (so the unique index only applies then). */
    emailKey: text("email_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("discount_code_usage_one_per_email_idx").on(t.codeId, t.emailKey), index("discount_code_usage_code_idx").on(t.codeId)],
);
