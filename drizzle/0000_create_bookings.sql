CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'rescheduled', 'cancelled');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_reference" text NOT NULL,
	"request_id" text,
	"package_id" text NOT NULL,
	"package_name" text NOT NULL,
	"package_price" integer NOT NULL,
	"parent_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"baby_name" text,
	"baby_age" text NOT NULL,
	"location_type" text DEFAULT 'client_home' NOT NULL,
	"location_address" text NOT NULL,
	"session_date" date NOT NULL,
	"session_start" timestamp with time zone NOT NULL,
	"session_end" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"notes" text,
	"inspiration_photo_id" text,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"outlook_event_id" text,
	"outlook_calendar_user" text,
	"confirmation_email_sent" boolean DEFAULT false NOT NULL,
	"confirmation_email_sent_at" timestamp with time zone,
	"confirmation_email_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_booking_reference_unique" UNIQUE("booking_reference"),
	CONSTRAINT "bookings_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_active_start_idx" ON "bookings" USING btree ("session_start") WHERE status <> 'cancelled';--> statement-breakpoint
CREATE INDEX "bookings_session_date_idx" ON "bookings" USING btree ("session_date");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_email_idx" ON "bookings" USING btree ("email");