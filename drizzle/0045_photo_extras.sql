-- Owner, Nov 20: photo extras after the session (extra edited photos, the full gallery, the unedited files), bought
-- from a link in the sneak-peek email and paid on Stripe. The settings row starts with the owner's prices (/admin →
-- Pricing edits them); each order keeps the prices it was bought at. Add-only, safe to run twice.
CREATE TABLE IF NOT EXISTS "photo_extras_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"extra_photo_cents" integer NOT NULL,
	"max_extras" integer NOT NULL,
	"full_gallery_cents" integer NOT NULL,
	"raw_files_cents" integer NOT NULL,
	"open_days" integer NOT NULL,
	"extras_delivery_hours" integer NOT NULL,
	"full_delivery_days" integer NOT NULL,
	"raw_delivery_hours" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_extras_settings_single_row" CHECK ("photo_extras_settings"."id" = 1),
	CONSTRAINT "photo_extras_settings_prices_check" CHECK ("photo_extras_settings"."extra_photo_cents" between 100 and 100000 and "photo_extras_settings"."full_gallery_cents" between 100 and 1000000 and "photo_extras_settings"."raw_files_cents" between 100 and 1000000),
	CONSTRAINT "photo_extras_settings_limits_check" CHECK ("photo_extras_settings"."max_extras" between 1 and 100 and "photo_extras_settings"."open_days" between 1 and 365),
	CONSTRAINT "photo_extras_settings_delivery_check" CHECK ("photo_extras_settings"."extras_delivery_hours" between 1 and 720 and "photo_extras_settings"."full_delivery_days" between 1 and 90 and "photo_extras_settings"."raw_delivery_hours" between 1 and 720)
);
--> statement-breakpoint
INSERT INTO "photo_extras_settings" ("id", "enabled", "extra_photo_cents", "max_extras", "full_gallery_cents", "raw_files_cents", "open_days", "extras_delivery_hours", "full_delivery_days", "raw_delivery_hours")
VALUES (1, true, 1300, 6, 25000, 11500, 30, 72, 5, 48)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photo_extra_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"lines" jsonb NOT NULL,
	"credit_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"note" text,
	"status" text DEFAULT 'open' NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "photo_extra_orders_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "photo_extra_orders_status_check" CHECK ("photo_extra_orders"."status" in ('open', 'paid', 'refunded')),
	CONSTRAINT "photo_extra_orders_total_check" CHECK ("photo_extra_orders"."total_cents" > 0 and "photo_extra_orders"."credit_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photo_extra_orders_booking_idx" ON "photo_extra_orders" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "photo_extra_orders_open_idx" ON "photo_extra_orders" USING btree ("booking_id") WHERE "photo_extra_orders"."status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "photo_extra_orders_session_idx" ON "photo_extra_orders" USING btree ("stripe_session_id");
