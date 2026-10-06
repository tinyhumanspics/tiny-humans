CREATE TABLE "booking_reschedule_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"old_session_start" timestamp with time zone NOT NULL,
	"old_session_end" timestamp with time zone NOT NULL,
	"new_session_start" timestamp with time zone NOT NULL,
	"new_session_end" timestamp with time zone NOT NULL,
	"rescheduled_by" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_reschedule_history_by_check" CHECK ("booking_reschedule_history"."rescheduled_by" in ('customer', 'admin'))
);
--> statement-breakpoint
ALTER TABLE "booking_settings" ADD COLUMN "customer_reschedule_notice_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_reschedule_history" ADD CONSTRAINT "booking_reschedule_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_reschedule_history_booking_idx" ON "booking_reschedule_history" USING btree ("booking_id","created_at");--> statement-breakpoint
ALTER TABLE "booking_settings" ADD CONSTRAINT "booking_settings_reschedule_notice_check" CHECK ("booking_settings"."customer_reschedule_notice_hours" between 0 and 336);