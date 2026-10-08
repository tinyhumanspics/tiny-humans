-- Customer language saved with the booking so every later customer email and manage page stays in the language used
-- at checkout. Existing bookings remain English. Run in Neon BEFORE deploying code that reads `bookings.locale`.
-- Safe to run more than once.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "locale" text DEFAULT 'en' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_locale_check') THEN
		ALTER TABLE "bookings" ADD CONSTRAINT "bookings_locale_check" CHECK ("locale" in ('en', 'es'));
	END IF;
END $$;

-- Neon should return one row per stored language; before Spanish launches, the existing rows should all say `en`.
SELECT "locale", count(*) AS "bookings" FROM "bookings" GROUP BY "locale" ORDER BY "locale";
