-- BUG-5: no two active bookings may overlap, buffer included, even when both are saved at the same moment.
-- The app already checks this before saving; this is the database's last line of defense (like the unique start time).
-- Each booking blocks [session_start, blocked_until), blocked_until = session_end + the buffer in force when it was
-- saved or moved (a trigger fills it; the app never writes it, so code and migration can ship in any order).
-- Lowering the buffer in /admin shrinks the upcoming bookings' ranges, so the database is never stricter than the app.
-- Existing bookings get blocked_until = session_end (no buffer), so the constraint can't trip over older bookings.
-- Safe to run twice. If the last statement fails with "conflicting key value violates exclusion constraint", two
-- active bookings already overlap: find them with
--   select a.booking_reference, b.booking_reference from bookings a join bookings b on a.id < b.id
--   where a.status <> 'cancelled' and b.status <> 'cancelled'
--     and tstzrange(a.session_start, a.session_end) && tstzrange(b.session_start, b.session_end);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "blocked_until" timestamp with time zone;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bookings_set_blocked_until() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.blocked_until := NEW.session_end + make_interval(mins => coalesce((SELECT buffer_minutes FROM booking_settings WHERE id = 1), 0));
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "bookings_blocked_until" ON "bookings";
--> statement-breakpoint
CREATE TRIGGER "bookings_blocked_until" BEFORE INSERT OR UPDATE OF "session_start", "session_end" ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION bookings_set_blocked_until();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION booking_settings_shrink_blocked() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE bookings SET blocked_until = session_end + make_interval(mins => NEW.buffer_minutes)
  WHERE status <> 'cancelled' AND blocked_until > session_end + make_interval(mins => NEW.buffer_minutes);
  RETURN NULL;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "booking_settings_buffer" ON "booking_settings";
--> statement-breakpoint
CREATE TRIGGER "booking_settings_buffer" AFTER INSERT OR UPDATE OF "buffer_minutes" ON "booking_settings"
  FOR EACH ROW EXECUTE FUNCTION booking_settings_shrink_blocked();
--> statement-breakpoint
UPDATE "bookings" SET "blocked_until" = "session_end" WHERE "blocked_until" IS NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "blocked_until" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
      EXCLUDE USING gist (tstzrange("session_start", "blocked_until") WITH &&) WHERE ("status" <> 'cancelled');
  END IF;
END $$;
