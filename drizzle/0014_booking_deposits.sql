-- Deposits: the on/off switch, each bundle's amount, and each booking's deposit. New tables only (safe to run twice).
-- Run in Neon BEFORE deploying the code that uses them; deposits stay off until switched on in /admin → Pricing &
-- Promotions → Deposits (a bundle without its own amount uses $50).
CREATE TABLE IF NOT EXISTS "booking_deposits" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent" text,
	"hold_until" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"refund_id" text,
	"refunded_at" timestamp with time zone,
	"refund_error" text,
	"confirming_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_deposits_status_check" CHECK ("booking_deposits"."status" in ('pending', 'paid', 'refunded', 'expired', 'unpaid')),
	CONSTRAINT "booking_deposits_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bundle_deposits" (
	"bundle_id" text PRIMARY KEY NOT NULL,
	"amount_cents" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_deposits_amount_check" CHECK ("bundle_deposits"."amount_cents" between 100 and 100000),
	CONSTRAINT "bundle_deposits_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deposit_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_settings_single_row" CHECK ("deposit_settings"."id" = 1)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_deposits_status_idx" ON "booking_deposits" USING btree ("status","hold_until");
