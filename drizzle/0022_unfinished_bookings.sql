-- Unfinished bookings (owner request, Nov 3): contact details typed on the booking form by families who didn't book,
-- their "What stopped you?" answers, unsubscribes, anonymous booking-form step counts and the mailing address for
-- marketing emails. New tables only: bookings work without them (nothing is saved until this runs). Safe to run twice.
CREATE TABLE IF NOT EXISTS "booking_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_key" text NOT NULL,
	"email" text NOT NULL,
	"parent_name" text,
	"phone" text,
	"bundle_id" text,
	"bundle_name" text,
	"session_date" date,
	"start_time" text,
	"zip" text,
	"travel_fee_cents" integer,
	"step" text DEFAULT 'details' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"source" text,
	"campaign" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"booked_reference" text,
	"booked_at" timestamp with time zone,
	"follow_up_status" text,
	"follow_up_error" text,
	"follow_up_attempts" integer DEFAULT 0 NOT NULL,
	"follow_up_sent_at" timestamp with time zone,
	"follow_up_resend_id" text,
	"link_token_hash" text,
	"feedback_reasons" text[],
	"feedback_comment" text,
	"feedback_at" timestamp with time zone,
	CONSTRAINT "booking_drafts_email_key_unique" UNIQUE("email_key"),
	CONSTRAINT "booking_drafts_link_token_hash_unique" UNIQUE("link_token_hash"),
	CONSTRAINT "booking_drafts_step_check" CHECK ("booking_drafts"."step" in ('details', 'review')),
	CONSTRAINT "booking_drafts_follow_up_check" CHECK ("booking_drafts"."follow_up_status" is null or "booking_drafts"."follow_up_status" in ('sending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_unsubscribes" (
	"email_key" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "funnel_counts" (
	"day" date NOT NULL,
	"step" text NOT NULL,
	"bundle_id" text NOT NULL,
	"source" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "funnel_counts_day_step_bundle_id_source_pk" PRIMARY KEY("day","step","bundle_id","source")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_settings" (
	"id" smallint PRIMARY KEY NOT NULL,
	"mailing_address" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_drafts_updated_idx" ON "booking_drafts" USING btree ("updated_at");
