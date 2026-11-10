-- Photo and video releases parents sign on the iPad in /admin → Leads (owner, Nov 9). One new table: nothing
-- existing changes, bookings and Leads work without it (the waiver button says to run this first). Safe to run twice.
-- A release is the business's record of permission: deleting a lead keeps it (booking_id becomes null) and a
-- trigger refuses any change to what was signed (only the status, revoke date/note and booking link may change).
CREATE TABLE IF NOT EXISTS "photo_waivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"booking_reference" text NOT NULL,
	"family_name" text NOT NULL,
	"children" jsonb NOT NULL,
	"session_date" date,
	"version" text NOT NULL,
	"language" text NOT NULL,
	"text_snapshot" jsonb NOT NULL,
	"text_sha256" text NOT NULL,
	"uses" jsonb NOT NULL,
	"first_name_ok" boolean NOT NULL,
	"signer_name" text NOT NULL,
	"relationship" text NOT NULL,
	"signature_png" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"status" text DEFAULT 'signed' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_waivers_language_check" CHECK ("photo_waivers"."language" in ('en', 'es')),
	CONSTRAINT "photo_waivers_relationship_check" CHECK ("photo_waivers"."relationship" in ('parent', 'guardian')),
	CONSTRAINT "photo_waivers_status_check" CHECK ("photo_waivers"."status" in ('signed', 'superseded', 'revoked')),
	CONSTRAINT "photo_waivers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photo_waivers_booking_idx" ON "photo_waivers" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photo_waivers_reference_idx" ON "photo_waivers" USING btree ("booking_reference");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "photo_waivers_one_signed_idx" ON "photo_waivers" USING btree ("booking_id") WHERE status = 'signed';
--> statement-breakpoint
-- What was signed never changes (not in lib/db/schema.ts, like bookings_no_overlap in 0015).
CREATE OR REPLACE FUNCTION "photo_waivers_keep_signed"() RETURNS trigger AS $$
BEGIN
	IF (NEW.id, NEW.booking_reference, NEW.family_name, NEW.children, NEW.session_date, NEW.version, NEW.language,
	    NEW.text_snapshot, NEW.text_sha256, NEW.uses, NEW.first_name_ok, NEW.signer_name, NEW.relationship,
	    NEW.signature_png, NEW.signed_at, NEW.user_agent, NEW.created_at)
	   IS DISTINCT FROM
	   (OLD.id, OLD.booking_reference, OLD.family_name, OLD.children, OLD.session_date, OLD.version, OLD.language,
	    OLD.text_snapshot, OLD.text_sha256, OLD.uses, OLD.first_name_ok, OLD.signer_name, OLD.relationship,
	    OLD.signature_png, OLD.signed_at, OLD.user_agent, OLD.created_at) THEN
		RAISE EXCEPTION 'A signed photo release cannot be changed' USING ERRCODE = 'check_violation';
	END IF;
	IF OLD.status <> 'signed' AND NEW.status IS DISTINCT FROM OLD.status THEN
		RAISE EXCEPTION 'A superseded or revoked photo release stays that way' USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "photo_waivers_keep_signed" ON "photo_waivers";
--> statement-breakpoint
CREATE TRIGGER "photo_waivers_keep_signed" BEFORE UPDATE ON "photo_waivers" FOR EACH ROW EXECUTE FUNCTION "photo_waivers_keep_signed"();
