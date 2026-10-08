-- Run in Neon BEFORE deploying the code that uses these columns (bookings insert every column).
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "travel_fee_cents" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "travel_miles" integer;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "travel_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"base_zip" text NOT NULL,
	"free_miles" integer NOT NULL,
	"per_mile_cents" integer NOT NULL,
	"max_miles" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "travel_settings_single_row" CHECK ("travel_settings"."id" = 1),
	CONSTRAINT "travel_settings_zip_check" CHECK ("travel_settings"."base_zip" ~ '^[0-9]{5}$'),
	CONSTRAINT "travel_settings_miles_check" CHECK ("travel_settings"."free_miles" between 0 and 500 and "travel_settings"."max_miles" between 1 and 1000),
	CONSTRAINT "travel_settings_price_check" CHECK ("travel_settings"."per_mile_cents" between 0 and 1000)
);
