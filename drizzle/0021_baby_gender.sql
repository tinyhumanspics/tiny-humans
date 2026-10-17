-- Optional baby gender (boy or girl) picked on the booking form, one row per baby that has one.
-- Bookings work without this table (the gender is just not saved), but run it in Neon before deploying so new
-- bookings keep it. Safe to run twice.
CREATE TABLE IF NOT EXISTS "booking_baby_genders" (
	"booking_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"gender" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_baby_genders_booking_id_position_pk" PRIMARY KEY("booking_id","position"),
	CONSTRAINT "booking_baby_genders_position_check" CHECK ("booking_baby_genders"."position" between 0 and 2),
	CONSTRAINT "booking_baby_genders_gender_check" CHECK ("booking_baby_genders"."gender" in ('boy', 'girl')),
	CONSTRAINT "booking_baby_genders_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);
