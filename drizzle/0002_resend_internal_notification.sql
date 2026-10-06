ALTER TABLE "bookings" ADD COLUMN "internal_notification_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "internal_notification_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "internal_notification_error" text;