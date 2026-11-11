-- "Not born yet" choices (owner, Nov 11): backdrops picked while reserving and the discount code entered (its terms
-- kept). Read best effort in code; a code is only accepted once this table exists. Safe to run twice.
CREATE TABLE IF NOT EXISTS "due_reservation_extras" (
	"reservation_id" uuid PRIMARY KEY NOT NULL REFERENCES "public"."due_date_reservations"("id") ON DELETE cascade,
	"backdrops" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discount_code" text,
	"discount_type" text,
	"discount_value" integer,
	"code_id" uuid,
	"usage_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
