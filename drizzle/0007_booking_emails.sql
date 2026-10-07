CREATE TABLE IF NOT EXISTS "booking_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"session_start" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"resend_id" text,
	"error" text,
	"link_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "booking_emails_link_token_hash_unique" UNIQUE("link_token_hash"),
	CONSTRAINT "booking_emails_status_check" CHECK ("booking_emails"."status" in ('sending', 'sent', 'failed')),
	CONSTRAINT "booking_emails_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_emails_once_idx" ON "booking_emails" USING btree ("booking_id","kind","session_start");
