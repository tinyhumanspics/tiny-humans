CREATE TABLE IF NOT EXISTS "booking_consents" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"sms" boolean DEFAULT false NOT NULL,
	"sms_at" timestamp with time zone,
	"photos" boolean DEFAULT false NOT NULL,
	"photos_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_consents_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);
