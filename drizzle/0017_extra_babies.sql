-- Extra-baby add-on: owner-managed per bundle; booking snapshots; every baby's name/age.
-- Run in Neon BEFORE deploying the code that reads `bookings.addons_total_cents`. Safe to run twice.
CREATE TABLE IF NOT EXISTS "booking_addons" (
	"booking_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_price_cents" integer NOT NULL,
	"extra_minutes" integer DEFAULT 0 NOT NULL,
	"extra_photos" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_addons_booking_id_kind_pk" PRIMARY KEY("booking_id","kind"),
	CONSTRAINT "booking_addons_quantity_check" CHECK ("booking_addons"."quantity" > 0),
	CONSTRAINT "booking_addons_price_check" CHECK ("booking_addons"."unit_price_cents" >= 0 and "booking_addons"."total_price_cents" >= 0),
	CONSTRAINT "booking_addons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_babies" (
	"booking_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"name" text,
	"age" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_babies_booking_id_position_pk" PRIMARY KEY("booking_id","position"),
	CONSTRAINT "booking_babies_position_check" CHECK ("booking_babies"."position" between 0 and 2),
	CONSTRAINT "booking_babies_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bundle_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"extra_minutes" integer DEFAULT 0 NOT NULL,
	"extra_photos" integer DEFAULT 0 NOT NULL,
	"max_quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_addons_price_check" CHECK ("bundle_addons"."unit_price_cents" >= 0),
	CONSTRAINT "bundle_addons_minutes_check" CHECK ("bundle_addons"."extra_minutes" between 0 and 240),
	CONSTRAINT "bundle_addons_photos_check" CHECK ("bundle_addons"."extra_photos" between 0 and 100),
	CONSTRAINT "bundle_addons_quantity_check" CHECK ("bundle_addons"."max_quantity" between 1 and 9),
	CONSTRAINT "bundle_addons_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "addons_total_cents" integer;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bundle_addons_bundle_kind_idx" ON "bundle_addons" USING btree ("bundle_id","kind");--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_addons_total_check') THEN
		ALTER TABLE "bookings" ADD CONSTRAINT "bookings_addons_total_check" CHECK ("addons_total_cents" is null or "addons_total_cents" >= 0);
	END IF;
END $$;--> statement-breakpoint
-- The owner's Oct 8 decision: twins/triplets on every current bundle; each extra baby is $75, +30 minutes and +5
-- edited photos. `max_quantity = 2` means two extra babies (three babies total). New bundles get the same defaults in
-- /admin but remain owner-editable.
INSERT INTO "bundle_addons" ("bundle_id", "kind", "name", "active", "unit_price_cents", "extra_minutes", "extra_photos", "max_quantity", "sort_order")
SELECT "id", 'extra_baby', 'Extra baby', true, 7500, 30, 5, 2, 0 FROM "bundles"
ON CONFLICT ("bundle_id", "kind") DO NOTHING;
