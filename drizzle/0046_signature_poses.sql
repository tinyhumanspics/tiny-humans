-- Owner, Nov 24: signature poses in /admin → Shoots. Every shoot lists them (folder and day sheet), each with the photos
-- to follow and how to set it up. Two new tables, nothing existing changes. Add-only, safe to run twice.
CREATE TABLE IF NOT EXISTS "shoot_signature_poses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shoot_signature_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pose_id" uuid NOT NULL,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"content_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shoot_signature_photos_pose_id_shoot_signature_poses_id_fk" FOREIGN KEY ("pose_id") REFERENCES "public"."shoot_signature_poses"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shoot_signature_photos_pose_idx" ON "shoot_signature_photos" USING btree ("pose_id","sort");
