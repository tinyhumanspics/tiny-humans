-- Failure log (brief 01): Stripe webhook, Meta CAPI, emails, Outlook calendar, booking creation, unhandled API errors
-- and daily jobs write a row here; critical ones email the owner (one per area per hour). Applied by the deploy.
CREATE TABLE IF NOT EXISTS "system_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"area" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"ref" text,
	"alerted_at" timestamp with time zone,
	CONSTRAINT "system_events_severity_check" CHECK ("system_events"."severity" in ('critical', 'error', 'warning'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_events_at_idx" ON "system_events" USING btree ("at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_events_area_alert_idx" ON "system_events" USING btree ("area","alerted_at");
