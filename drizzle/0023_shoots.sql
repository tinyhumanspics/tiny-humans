-- Shoots in /admin (owner, Nov 9): each booking's shoot folder (inspo + BTS ideas, notes), shoots without a booking,
-- "What we always bring" sections and the ticks on a day sheet. New tables only: nothing existing changes, bookings
-- work without them, and /admin → Shoots says "Run the shoots migration" until this runs. Safe to run twice.
-- Deleting a booking deletes its shoot row and inspo rows (ON DELETE CASCADE); the app deletes their files first.
CREATE TABLE IF NOT EXISTS "shoot_bring_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shoots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"booking_id" uuid,
	"date" date,
	"start_time" text,
	"place" text,
	"title" text,
	"tab_label" text,
	"said" text,
	"confirm" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bring_extra" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shoots_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "shoots_kind_check" CHECK ("shoots"."kind" in ('booking', 'styled')),
	CONSTRAINT "shoots_kind_fields_check" CHECK (("shoots"."kind" = 'booking' and "shoots"."booking_id" is not null) or ("shoots"."kind" = 'styled' and "shoots"."booking_id" is null and "shoots"."date" is not null)),
	CONSTRAINT "shoots_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shoot_inspo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shoot_id" uuid NOT NULL,
	"group" text NOT NULL,
	"type" text NOT NULL,
	"blob_url" text,
	"blob_pathname" text,
	"content_type" text,
	"bytes" integer,
	"width" integer,
	"height" integer,
	"link_url" text,
	"platform" text,
	"caption" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shoot_inspo_group_check" CHECK ("shoot_inspo"."group" in ('inspo', 'bts')),
	CONSTRAINT "shoot_inspo_type_check" CHECK ("shoot_inspo"."type" in ('image', 'video', 'link', 'note')),
	CONSTRAINT "shoot_inspo_content_check" CHECK (("shoot_inspo"."type" in ('image', 'video') and "shoot_inspo"."blob_url" is not null and "shoot_inspo"."blob_pathname" is not null) or ("shoot_inspo"."type" = 'link' and "shoot_inspo"."link_url" is not null) or "shoot_inspo"."type" = 'note'),
	CONSTRAINT "shoot_inspo_shoot_id_shoots_id_fk" FOREIGN KEY ("shoot_id") REFERENCES "public"."shoots"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shoot_ticks" (
	"date" date NOT NULL,
	"key" text NOT NULL,
	"ticked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shoot_ticks_date_key_pk" PRIMARY KEY("date","key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shoot_inspo_shoot_idx" ON "shoot_inspo" USING btree ("shoot_id","group","sort");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shoots_date_idx" ON "shoots" USING btree ("date");
--> statement-breakpoint
-- The starting "What we always bring" sections (lib/shoots/lists.ts), only while the table is still empty.
INSERT INTO "shoot_bring_sections" ("name", "items", "sort")
SELECT v.name, v.items::jsonb, v.sort FROM (VALUES
	('Studio kit', '["Backdrop stand + clamps","Posing beanbag + spare covers and layers","Posing pillows and wedges","Space heater","White noise machine","Wraps, bonnets and outfits","Puppy pads, wipes, hand sanitizer","Extension cord","Step stool"]', 0),
	('Camera gear', '["Camera + 2 charged batteries","2 empty memory cards + 1 spare","50 mm lens","35 mm lens (family shots)","Macro lens (details)","Light + softbox","Reflector","Tripod","Phone + small tripod for the BTS clips","Power bank"]', 1),
	('Wardrobe (Adri and Alo)', '["Neutral clothes, no big logos (you''re in the clips)","Soft fabrics, nothing scratchy (you''ll hold baby)","No perfume or cologne","Clean socks, indoor shoes","Jewelry off while posing baby","Hair tied back"]', 2)
) AS v(name, items, sort)
WHERE NOT EXISTS (SELECT 1 FROM "shoot_bring_sections");
