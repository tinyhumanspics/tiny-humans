-- Leads → Completed (owner, Nov 11): sessions the owner marked done (past clients, for email marketing). The booking
-- itself doesn't change. Leads work without this table (the Completed section is just empty). Safe to run twice.
CREATE TABLE IF NOT EXISTS "booking_completions" (
	"booking_id" uuid PRIMARY KEY NOT NULL REFERENCES "public"."bookings"("id") ON DELETE cascade,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
