CREATE TABLE IF NOT EXISTS "booking_payments" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_payments_status_check" CHECK ("booking_payments"."status" in ('open', 'paid')),
	CONSTRAINT "booking_payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"body" text NOT NULL,
	"display_name" text NOT NULL,
	"consent_public" boolean DEFAULT false NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "reviews_rating_check" CHECK ("reviews"."rating" between 1 and 5),
	CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);
