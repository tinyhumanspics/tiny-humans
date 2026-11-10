-- "Not born yet" (owner, Nov 10): families reserve a bundle with their due date (and pay the deposit when deposits
-- are on); when the baby is born they, or the owner in /admin → Leads → Due dates, pick the session, which becomes a
-- normal booking without a new deposit. New table only: nothing that exists today reads it, so bookings keep working
-- with or without it. Run this BEFORE deploying the code. Safe to run twice.
CREATE TABLE IF NOT EXISTS "due_date_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"request_id" text,
	"package_id" text NOT NULL,
	"package_name" text NOT NULL,
	"regular_price_cents" integer NOT NULL,
	"bundle_price_cents" integer NOT NULL,
	"offer_label" text,
	"baby_count" integer DEFAULT 1 NOT NULL,
	"due_date" date NOT NULL,
	"parent_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"street" text NOT NULL,
	"unit" text,
	"city" text NOT NULL,
	"zip" text NOT NULL,
	"notes" text,
	"travel_fee_cents" integer,
	"travel_miles" integer,
	"status" text DEFAULT 'reserved' NOT NULL,
	"deposit_cents" integer DEFAULT 0 NOT NULL,
	"deposit_status" text DEFAULT 'none' NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent" text,
	"deposit_paid_at" timestamp with time zone,
	"refund_id" text,
	"schedule_token_hash" text NOT NULL,
	"booking_id" uuid,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "due_date_reservations_reference_unique" UNIQUE("reference"),
	CONSTRAINT "due_date_reservations_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "due_date_reservations_status_check" CHECK ("due_date_reservations"."status" in ('pending', 'reserved', 'scheduling', 'scheduled', 'cancelled', 'expired')),
	CONSTRAINT "due_date_reservations_deposit_check" CHECK ("due_date_reservations"."deposit_status" in ('none', 'pending', 'paid', 'unpaid', 'refunded', 'expired')),
	CONSTRAINT "due_date_reservations_babies_check" CHECK ("due_date_reservations"."baby_count" between 1 and 3),
	CONSTRAINT "due_date_reservations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "due_date_reservations_status_idx" ON "due_date_reservations" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "due_date_reservations_token_idx" ON "due_date_reservations" USING btree ("schedule_token_hash");