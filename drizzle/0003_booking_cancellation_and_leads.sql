ALTER TABLE "bookings" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancel_token_hash" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_email_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_email_error" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "internal_cancellation_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "internal_cancellation_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "internal_cancellation_error" text;--> statement-breakpoint
CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancel_token_hash_unique" UNIQUE("cancel_token_hash");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_check" CHECK ("bookings"."cancelled_by" is null or "bookings"."cancelled_by" in ('customer', 'admin'));