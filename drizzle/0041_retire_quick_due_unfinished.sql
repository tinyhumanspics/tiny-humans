-- Brief 04: /quick, /due-date and unfinished bookings are gone.
-- destructive-ok: owner approved on Nov 15, 2026 deleting the quick form's requests (tests only), unfinished-booking drafts + answers, the unsubscribe list and mailing address (only for those follow-ups) and trip-day settings (off since brief 02). The live code reads these tables best effort.
-- 1) Open due-date reservations ("Not born yet") move into Requests, linked by due_id, so the owner sees them there:
--    waiting on the deposit = confirmed, deposit paid (or none) = booked. Safe to run twice (client_id is unique).
INSERT INTO "booking_requests" ("reference", "client_id", "created_at", "updated_at", "locale", "type", "status", "bundle_id", "bundle_name", "baby_count", "bundle_cents", "addons_cents", "total_cents", "pricing", "due_date", "first_name", "mobile", "email", "zip", "travel_miles", "travel_fee_cents", "due_id")
SELECT
	'TH-R-D' || substring(d."reference" from 5),
	'due-' || d."id",
	d."created_at",
	now(),
	d."locale",
	'due_date',
	CASE WHEN d."status" IN ('reserved', 'scheduling') AND d."deposit_status" IN ('paid', 'none') THEN 'booked' ELSE 'confirmed' END,
	d."package_id",
	d."package_name",
	d."baby_count",
	d."bundle_price_cents",
	0,
	d."bundle_price_cents",
	json_build_object('migratedFrom', d."reference")::jsonb,
	d."due_date",
	split_part(trim(d."parent_name"), ' ', 1),
	CASE
		WHEN length(regexp_replace(d."phone", '\D', '', 'g')) = 10 THEN '+1' || regexp_replace(d."phone", '\D', '', 'g')
		WHEN length(regexp_replace(d."phone", '\D', '', 'g')) = 11 AND left(regexp_replace(d."phone", '\D', '', 'g'), 1) = '1' THEN '+' || regexp_replace(d."phone", '\D', '', 'g')
		ELSE d."phone"
	END,
	d."email",
	d."zip",
	d."travel_miles",
	coalesce(d."travel_fee_cents", 0),
	d."id"
FROM "due_date_reservations" d
WHERE d."status" IN ('pending', 'expired', 'reserved', 'scheduling')
	AND d."booking_id" IS NULL
	AND d."cancelled_at" IS NULL
	AND NOT EXISTS (SELECT 1 FROM "booking_requests" r WHERE r."due_id" = d."id")
ON CONFLICT ("client_id") DO NOTHING;
--> statement-breakpoint
-- 2) The retired features' tables.
DROP TABLE IF EXISTS "booking_draft_forms" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "booking_drafts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "email_unsubscribes" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "marketing_settings" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "quick_requests" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "trip_settings" CASCADE;
