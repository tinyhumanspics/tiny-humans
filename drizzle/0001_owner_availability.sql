CREATE TABLE "availability_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_blocks_hours_check" CHECK ("availability_blocks"."end_time" > "availability_blocks"."start_time")
);
--> statement-breakpoint
CREATE TABLE "availability_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"is_closed" boolean DEFAULT true NOT NULL,
	"start_time" time,
	"end_time" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_overrides_date_unique" UNIQUE("date"),
	CONSTRAINT "availability_overrides_hours_check" CHECK ("availability_overrides"."is_closed" or ("availability_overrides"."start_time" is not null and "availability_overrides"."end_time" is not null and "availability_overrides"."end_time" > "availability_overrides"."start_time"))
);
--> statement-breakpoint
CREATE TABLE "availability_weekly" (
	"weekday" smallint PRIMARY KEY NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"start_time" time DEFAULT '09:00' NOT NULL,
	"end_time" time DEFAULT '18:00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_weekly_weekday_check" CHECK ("availability_weekly"."weekday" between 0 and 6),
	CONSTRAINT "availability_weekly_hours_check" CHECK ("availability_weekly"."end_time" > "availability_weekly"."start_time")
);
--> statement-breakpoint
CREATE TABLE "booking_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"minimum_notice_days" integer DEFAULT 1 NOT NULL,
	"booking_window_days" integer DEFAULT 90 NOT NULL,
	"buffer_minutes" integer DEFAULT 45 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_settings_single_row" CHECK ("booking_settings"."id" = 1),
	CONSTRAINT "booking_settings_notice_check" CHECK ("booking_settings"."minimum_notice_days" between 0 and 60),
	CONSTRAINT "booking_settings_window_check" CHECK ("booking_settings"."booking_window_days" between 1 and 365),
	CONSTRAINT "booking_settings_buffer_check" CHECK ("booking_settings"."buffer_minutes" between 0 and 240)
);
--> statement-breakpoint
CREATE INDEX "availability_blocks_date_idx" ON "availability_blocks" USING btree ("date");--> statement-breakpoint
-- Default availability (matches the original behaviour). ON CONFLICT DO NOTHING: never overwrites the owner's settings.
INSERT INTO "availability_weekly" ("weekday", "is_open", "start_time", "end_time") VALUES
  (0, false, '09:00', '18:00'),
  (1, true, '09:00', '18:00'),
  (2, true, '09:00', '18:00'),
  (3, true, '09:00', '18:00'),
  (4, true, '09:00', '18:00'),
  (5, true, '09:00', '18:00'),
  (6, true, '09:00', '18:00')
ON CONFLICT ("weekday") DO NOTHING;--> statement-breakpoint
INSERT INTO "booking_settings" ("id", "minimum_notice_days", "booking_window_days", "buffer_minutes") VALUES (1, 1, 90, 45)
ON CONFLICT ("id") DO NOTHING;
