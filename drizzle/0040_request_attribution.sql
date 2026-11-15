-- Brief 03: where each request came from (first + last touch, Meta ad ids), its match data for Meta (fbp/fbc/IP/user
-- agent) and when its Lead was sent; the source the owner picks for a booking made by hand. Add-only, safe to run twice.
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "first_touch" jsonb;
--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "last_touch" jsonb;
--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "ad_id" text;
--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "adset_id" text;
--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "campaign_id" text;
--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "fbp" text;
--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "fbc" text;
--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "client_ip" text;
--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "user_agent" text;
--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "lead_sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "owner_source" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_requests_lead_idx" ON "booking_requests" USING btree ("lead_sent_at");
