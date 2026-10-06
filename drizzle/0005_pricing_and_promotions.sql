CREATE TABLE "bundle_inclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" text NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"regular_price_cents" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"duration_label" text,
	"photos_label" text,
	"badge" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"offer_enabled" boolean DEFAULT false NOT NULL,
	"offer_price_cents" integer,
	"offer_label" text,
	"offer_ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundles_price_check" CHECK ("bundles"."regular_price_cents" >= 0),
	CONSTRAINT "bundles_duration_check" CHECK ("bundles"."duration_minutes" between 15 and 480),
	CONSTRAINT "bundles_offer_check" CHECK ("bundles"."offer_price_cents" is null or ("bundles"."offer_price_cents" >= 0 and "bundles"."offer_price_cents" < "bundles"."regular_price_cents"))
);
--> statement-breakpoint
CREATE TABLE "discount_code_bundles" (
	"code_id" uuid NOT NULL,
	"bundle_id" text NOT NULL,
	CONSTRAINT "discount_code_bundles_code_id_bundle_id_pk" PRIMARY KEY("code_id","bundle_id")
);
--> statement-breakpoint
CREATE TABLE "discount_code_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"booking_id" uuid,
	"email" text NOT NULL,
	"email_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_on" date,
	"max_uses" integer,
	"one_per_email" boolean DEFAULT false NOT NULL,
	"internal_note" text,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_code_unique" UNIQUE("code"),
	CONSTRAINT "discount_codes_type_check" CHECK ("discount_codes"."discount_type" in ('percent', 'fixed')),
	CONSTRAINT "discount_codes_value_check" CHECK ("discount_codes"."discount_value" > 0 and ("discount_codes"."discount_type" <> 'percent' or "discount_codes"."discount_value" <= 100)),
	CONSTRAINT "discount_codes_max_uses_check" CHECK ("discount_codes"."max_uses" is null or "discount_codes"."max_uses" > 0)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "regular_price_cents" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "offer_price_cents" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "offer_label" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_code" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_amount_cents" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "final_price_cents" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pricing_type" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "package_inclusions" jsonb;--> statement-breakpoint
ALTER TABLE "bundle_inclusions" ADD CONSTRAINT "bundle_inclusions_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_code_bundles" ADD CONSTRAINT "discount_code_bundles_code_id_discount_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."discount_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_code_bundles" ADD CONSTRAINT "discount_code_bundles_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_code_usage" ADD CONSTRAINT "discount_code_usage_code_id_discount_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."discount_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_code_usage" ADD CONSTRAINT "discount_code_usage_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bundle_inclusions_bundle_idx" ON "bundle_inclusions" USING btree ("bundle_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_code_usage_one_per_email_idx" ON "discount_code_usage" USING btree ("code_id","email_key");--> statement-breakpoint
CREATE INDEX "discount_code_usage_code_idx" ON "discount_code_usage" USING btree ("code_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pricing_type_check" CHECK ("bookings"."pricing_type" is null or "bookings"."pricing_type" in ('regular', 'offer', 'discount'));
--> statement-breakpoint
-- Seed the current bundles (never overwrites the owner's edits).
INSERT INTO "bundles" ("id", "name", "regular_price_cents", "duration_minutes", "duration_label", "photos_label", "badge", "sort_order") VALUES
  ('little-moments', 'Little Moments', 9900, 45, 'Up to 45 minutes', '5–8', NULL, 0),
  ('our-little-story', 'Our Little Story', 19900, 90, 'Up to 90 minutes', '15–20', 'Most loved', 1),
  ('forever-little', 'Forever Little', 24900, 120, 'Up to 2 hours', '25–35', NULL, 2)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "bundle_inclusions" ("bundle_id", "position", "text")
  SELECT * FROM (SELECT 'little-moments', 0, 'Up to 45 minutes' UNION ALL SELECT 'little-moments', 1, 'Baby only' UNION ALL SELECT 'little-moments', 2, '1 setup' UNION ALL SELECT 'little-moments', 3, '5–8 edited digital photos') AS v(bundle_id, position, text)
  WHERE NOT EXISTS (SELECT 1 FROM "bundle_inclusions" WHERE "bundle_id" = 'little-moments');--> statement-breakpoint
INSERT INTO "bundle_inclusions" ("bundle_id", "position", "text")
  SELECT * FROM (SELECT 'our-little-story', 0, 'Up to 90 minutes' UNION ALL SELECT 'our-little-story', 1, 'Baby + parents + siblings' UNION ALL SELECT 'our-little-story', 2, '2 setups' UNION ALL SELECT 'our-little-story', 3, '15–20 edited digital photos') AS v(bundle_id, position, text)
  WHERE NOT EXISTS (SELECT 1 FROM "bundle_inclusions" WHERE "bundle_id" = 'our-little-story');--> statement-breakpoint
INSERT INTO "bundle_inclusions" ("bundle_id", "position", "text")
  SELECT * FROM (SELECT 'forever-little', 0, 'Up to 2 hours' UNION ALL SELECT 'forever-little', 1, 'Baby + parents + siblings' UNION ALL SELECT 'forever-little', 2, 'Up to 3 setups' UNION ALL SELECT 'forever-little', 3, '25–35 edited digital photos') AS v(bundle_id, position, text)
  WHERE NOT EXISTS (SELECT 1 FROM "bundle_inclusions" WHERE "bundle_id" = 'forever-little');--> statement-breakpoint
-- Older bookings: their price snapshot is the package price they already have.
UPDATE "bookings" SET "regular_price_cents" = "package_price" * 100, "final_price_cents" = "package_price" * 100, "pricing_type" = 'regular' WHERE "final_price_cents" IS NULL;
