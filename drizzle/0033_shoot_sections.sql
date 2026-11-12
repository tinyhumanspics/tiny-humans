-- The owner's own sections inside a shoot's Inspo and BTS (owner, Nov 12: "Inspo for David · Section 2", e.g. a second
-- outfit on the same set, or phone videos vs a Reel). 1) shoot_sections: one row per section (name, Inspo or BTS,
-- order). 2) shoot_inspo.section_id: which section a shot is in (empty = the main one); removing a section moves its
-- shots back to the main one. Read and written best effort in code: before this runs, Shoots works exactly as before
-- and "+ Add a section" explains this step. Safe to run twice.
CREATE TABLE IF NOT EXISTS "shoot_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shoot_id" uuid NOT NULL,
	"group" text NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shoot_sections_shoot_id_shoots_id_fk" FOREIGN KEY ("shoot_id") REFERENCES "public"."shoots"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "shoot_sections_group_check" CHECK ("shoot_sections"."group" in ('inspo', 'bts')),
	CONSTRAINT "shoot_sections_name_check" CHECK (char_length("shoot_sections"."name") between 1 and 80)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shoot_sections_shoot_idx" ON "shoot_sections" USING btree ("shoot_id","group","sort");
--> statement-breakpoint
ALTER TABLE "shoot_inspo" ADD COLUMN IF NOT EXISTS "section_id" uuid REFERENCES "public"."shoot_sections"("id") ON DELETE set null;
