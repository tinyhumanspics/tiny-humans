-- Owner, Nov 24: families booking a bundle with 2+ setups can write prop ideas on /book; the owner sees them on the
-- request and they start the booking's notes. One new optional column. Add-only, safe to run twice.
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "prop_ideas" text;
