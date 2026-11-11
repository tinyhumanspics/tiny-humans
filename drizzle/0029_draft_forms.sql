-- Unfinished bookings from "Not born yet?" (owner, Nov 11): which form a saved draft came from. Only the due-date form
-- gets a row ("due_date"); no row = the booking form. Drafts keep saving without this table (the label just doesn't
-- show). Safe to run twice.
CREATE TABLE IF NOT EXISTS "booking_draft_forms" (
	"draft_id" uuid PRIMARY KEY NOT NULL REFERENCES "public"."booking_drafts"("id") ON DELETE cascade,
	"form" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_draft_forms_form_check" CHECK ("booking_draft_forms"."form" in ('due_date'))
);
