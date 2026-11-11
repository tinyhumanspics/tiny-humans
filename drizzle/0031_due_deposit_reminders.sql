-- Leads → Not paid (owner, Nov 11): deposit reminders emailed to "Not born yet" families (best effort in code).
CREATE TABLE IF NOT EXISTS "due_deposit_reminders" (
	"reservation_id" uuid PRIMARY KEY NOT NULL REFERENCES "public"."due_date_reservations"("id") ON DELETE cascade,
	"count" integer DEFAULT 1 NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
