-- Owner, Nov 20: every email sent to a family, on their lead, with Resend's delivery result (delivered, bounced, spam).
-- sendEmail logs each one from now on; this copies in what older records already had (confirmation and cancellation
-- emails, reminders, pay links, after-session emails), and the problems Resend reported for those. Add-only, safe to
-- run twice (each copied row has a legacy_key).
CREATE TABLE IF NOT EXISTS "sent_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"scope" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text,
	"status" text NOT NULL,
	"error" text,
	"resend_id" text,
	"legacy_key" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"problem" text,
	"problem_detail" text,
	"problem_at" timestamp with time zone,
	CONSTRAINT "sent_emails_status_check" CHECK ("sent_emails"."status" in ('sent', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sent_emails_reference_idx" ON "sent_emails" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sent_emails_resend_idx" ON "sent_emails" USING btree ("resend_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sent_emails_legacy_idx" ON "sent_emails" USING btree ("legacy_key");--> statement-breakpoint
INSERT INTO "sent_emails" ("reference", "scope", "recipient", "status", "error", "sent_at", "legacy_key")
SELECT "booking_reference", 'resend.customer', lower(trim("email")),
	CASE WHEN "confirmation_email_sent" THEN 'sent' ELSE 'failed' END, "confirmation_email_error",
	coalesce("confirmation_email_sent_at", "updated_at"), 'confirmation:' || "id"
FROM "bookings" WHERE "confirmation_email_sent" OR "confirmation_email_error" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "sent_emails" ("reference", "scope", "recipient", "status", "error", "sent_at", "legacy_key")
SELECT "booking_reference", 'resend.cancellation', lower(trim("email")),
	CASE WHEN "cancellation_email_sent" THEN 'sent' ELSE 'failed' END, "cancellation_email_error",
	coalesce("cancellation_email_sent_at", "updated_at"), 'cancellation:' || "id"
FROM "bookings" WHERE "cancellation_email_sent" OR "cancellation_email_error" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "sent_emails" ("reference", "scope", "recipient", "status", "error", "resend_id", "sent_at", "legacy_key")
SELECT b."booking_reference",
	CASE e."kind" WHEN 'reminder_72h' THEN 'resend.reminder-72h' WHEN 'reminder_24h' THEN 'resend.reminder-24h' ELSE 'resend.' || e."kind" END,
	lower(trim(b."email")), e."status", e."error", e."resend_id", coalesce(e."sent_at", e."updated_at"), 'booking_emails:' || e."id"
FROM "booking_emails" e JOIN "bookings" b ON b."id" = e."booking_id"
WHERE e."status" IN ('sent', 'failed')
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "sent_emails" s SET "problem" = ev."type", "problem_detail" = ev."detail", "problem_at" = ev."occurred_at"
FROM "email_events" ev
WHERE s."resend_id" IS NOT NULL AND ev."email_id" = s."resend_id" AND s."problem" IS NULL;
