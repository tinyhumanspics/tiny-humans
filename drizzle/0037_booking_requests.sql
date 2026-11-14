-- Booking requests (brief 02): the new /book sends a request (nothing paid); a day + time is held 12 hours while the
-- owner confirms by text. Applied by the deploy (scripts/migrate.mjs). Safe to run twice.
CREATE TABLE IF NOT EXISTS "booking_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"client_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"bundle_id" text NOT NULL,
	"bundle_name" text NOT NULL,
	"baby_count" integer DEFAULT 1 NOT NULL,
	"bundle_cents" integer NOT NULL,
	"addons_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"pricing" jsonb NOT NULL,
	"slot_date" date,
	"slot_start" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"due_date" date,
	"hold_until" timestamp with time zone,
	"first_name" text NOT NULL,
	"mobile" text NOT NULL,
	"email" text NOT NULL,
	"zip" text NOT NULL,
	"travel_status" text,
	"travel_miles" integer,
	"travel_fee_cents" integer DEFAULT 0 NOT NULL,
	"text_consent" boolean DEFAULT false NOT NULL,
	"consent_version" text,
	"booking_id" uuid,
	CONSTRAINT "booking_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "booking_requests_type_check" CHECK ("booking_requests"."type" in ('date', 'due_date')),
	CONSTRAINT "booking_requests_status_check" CHECK ("booking_requests"."status" in ('new', 'confirmed', 'booked', 'declined', 'expired')),
	CONSTRAINT "booking_requests_locale_check" CHECK ("booking_requests"."locale" in ('en', 'es')),
	CONSTRAINT "booking_requests_when_check" CHECK (("booking_requests"."type" = 'date' AND "booking_requests"."slot_date" IS NOT NULL AND "booking_requests"."starts_at" IS NOT NULL) OR ("booking_requests"."type" = 'due_date' AND "booking_requests"."due_date" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_requests_reference_idx" ON "booking_requests" USING btree ("reference");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_requests_client_idx" ON "booking_requests" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_requests_created_idx" ON "booking_requests" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_requests_hold_idx" ON "booking_requests" USING btree ("slot_date") WHERE status = 'new' AND type = 'date';