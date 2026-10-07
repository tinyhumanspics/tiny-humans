CREATE TABLE IF NOT EXISTS "booking_terms" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"notice_hours" integer NOT NULL,
	"photos_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_terms_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
-- Existing bookings keep the rule in force today (and their bundle's photo count).
INSERT INTO "booking_terms" ("booking_id", "notice_hours", "photos_label")
SELECT b."id", COALESCE((SELECT "customer_reschedule_notice_hours" FROM "booking_settings" WHERE "id" = 1), 48), bu."photos_label"
FROM "bookings" b LEFT JOIN "bundles" bu ON bu."id" = b."package_id"
ON CONFLICT ("booking_id") DO NOTHING;
