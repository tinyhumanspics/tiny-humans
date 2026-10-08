CREATE TABLE IF NOT EXISTS "booking_backdrops" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"picks" jsonb NOT NULL,
	"source" text DEFAULT 'booking' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_backdrops_source_check" CHECK ("booking_backdrops"."source" in ('booking', 'family')),
	CONSTRAINT "booking_backdrops_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);
