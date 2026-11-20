-- Owner, Nov 19: /admin → Quotes / Booking → "Send a booking link": the session a family agreed with the owner
-- (bundle, babies, ZIP, day, optional time); their link opens /book filled in and is used once. Only the token's
-- SHA-256 hash is stored. Add-only, safe to run twice.
CREATE TABLE IF NOT EXISTS "booking_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"bundle_id" text NOT NULL,
	"babies" jsonb NOT NULL,
	"zip" text NOT NULL,
	"slot_date" date NOT NULL,
	"slot_start" text,
	"source" text NOT NULL,
	"request_id" uuid,
	"used_at" timestamp with time zone,
	CONSTRAINT "booking_links_request_id_booking_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."booking_requests"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "booking_links_locale_check" CHECK ("booking_links"."locale" in ('en', 'es'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_links_token_idx" ON "booking_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_links_request_idx" ON "booking_links" USING btree ("request_id");
