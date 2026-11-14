-- The quick form (/quick, owner Nov 13): families who'd rather send their details than book online; the owners book
-- for them in /admin → Quotes / Booking. Read and written best effort in code: before this runs the form still works
-- (the studio gets the email), only the list in /admin waits for it. Safe to run twice.
CREATE TABLE IF NOT EXISTS "quick_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"zip" text NOT NULL,
	"baby_name" text,
	"baby_age" text,
	"due_date" date,
	"bundle_id" text,
	"best_time" text,
	"message" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"booking_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quick_requests_status_check" CHECK ("quick_requests"."status" in ('new', 'booked', 'done')),
	CONSTRAINT "quick_requests_locale_check" CHECK ("quick_requests"."locale" in ('en', 'es'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quick_requests_created_idx" ON "quick_requests" USING btree ("created_at");