-- Email delivery problems from Resend's webhook (bounced, marked as spam, suppressed, failed), shown on the lead in
-- /admin. New table only (safe to run twice). Run in Neon before adding the webhook in Resend; until it runs, the
-- webhook answers 500 and Resend retries (for about a day), and /admin simply shows no email problems.
CREATE TABLE IF NOT EXISTS "email_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"email_id" text,
	"recipient" text NOT NULL,
	"booking_reference" text,
	"category" text,
	"detail" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_events_type_check" CHECK ("email_events"."type" in ('bounced', 'complained', 'suppressed', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_recipient_idx" ON "email_events" USING btree ("recipient");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_booking_idx" ON "email_events" USING btree ("booking_reference");
