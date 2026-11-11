-- Trip days (owner, Nov 10): a session more than 60 road miles away (e.g. Orlando) takes the whole day; that day only
-- families within 30 miles of it can book, and the next morning stays free until 12 PM. This table only stores the
-- owner's numbers from /admin → Availability → Travel; without it the same defaults apply, so bookings work either way.
-- Safe to run twice.
CREATE TABLE IF NOT EXISTS "trip_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"trip_miles" integer DEFAULT 60 NOT NULL,
	"same_trip_miles" integer DEFAULT 30 NOT NULL,
	"next_day_until" text DEFAULT '12:00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_settings_single_row" CHECK ("trip_settings"."id" = 1),
	CONSTRAINT "trip_settings_miles_check" CHECK ("trip_settings"."trip_miles" between 10 and 1000 and "trip_settings"."same_trip_miles" between 1 and 200),
	CONSTRAINT "trip_settings_time_check" CHECK ("trip_settings"."next_day_until" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
