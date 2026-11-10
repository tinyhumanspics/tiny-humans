-- Family members and "who's in the shot" (owner, Nov 10). 1) booking_family_members: on bundles that include the
-- family (Our Family Story), the parent lists who else is in the photos (role + optional name). New table only:
-- bookings work without it (best-effort insert). 2) shoot_inspo.who: which people of the booking a shot idea is for
-- ("all", "baby:0", "fam:1", …). 3) Our Family Story's extra-person charge: 5 people included (babies count), $75 per
-- extra person, up to 5 extra (editable in /admin → Pricing). Today's code ignores that row until the new code is live.
-- Run this BEFORE deploying the code (Drizzle lists every column). Safe to run twice.
CREATE TABLE IF NOT EXISTS "booking_family_members" (
	"booking_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"role" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_family_members_booking_id_position_pk" PRIMARY KEY("booking_id","position"),
	CONSTRAINT "booking_family_members_position_check" CHECK ("booking_family_members"."position" between 0 and 13),
	CONSTRAINT "booking_family_members_role_check" CHECK ("booking_family_members"."role" in ('mom', 'dad', 'sister', 'brother', 'grandma', 'grandpa', 'aunt', 'uncle', 'cousin', 'other')),
	CONSTRAINT "booking_family_members_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
ALTER TABLE "shoot_inspo" ADD COLUMN IF NOT EXISTS "who" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking_family_members" DROP CONSTRAINT IF EXISTS "booking_family_members_position_check";
--> statement-breakpoint
ALTER TABLE "booking_family_members" ADD CONSTRAINT "booking_family_members_position_check" CHECK ("booking_family_members"."position" between 0 and 13);
--> statement-breakpoint
ALTER TABLE "bundle_addons" DROP CONSTRAINT IF EXISTS "bundle_addons_kind_check";
--> statement-breakpoint
ALTER TABLE "bundle_addons" ADD CONSTRAINT "bundle_addons_kind_check" CHECK ("bundle_addons"."kind" in ('extra_baby', 'extra_person'));
--> statement-breakpoint
INSERT INTO "bundle_addons" ("bundle_id", "kind", "name", "active", "unit_price_cents", "extra_minutes", "extra_photos", "max_quantity", "sort_order")
SELECT "id", 'extra_person', 'Extra family member', true, 7500, 0, 0, 5, 1 FROM "bundles" WHERE "id" = 'forever-little' OR "name" = 'Our Family Story'
ON CONFLICT ("bundle_id", "kind") DO NOTHING;
