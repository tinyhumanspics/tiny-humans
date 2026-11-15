-- Booking requests (brief 02, part 2): a "Not born yet" request the owner confirms becomes a due-date reservation;
-- this links the two so paying its deposit marks the request booked. Add-only, safe to run twice.
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "due_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_due_id_due_date_reservations_id_fk" FOREIGN KEY ("due_id") REFERENCES "public"."due_date_reservations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
