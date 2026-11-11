-- Discount code categories (owner, Nov 10): which campaign a code belongs to ("Thanksgiving offer", "Christmas offer",
-- "Happy Valentine's offer" or the owner's own words), shown in /admin → Pricing and on each lead that used the code.
-- Owner-only; codes and checkout work without this table (categories just don't show). Safe to run twice.
CREATE TABLE IF NOT EXISTS "discount_code_categories" (
	"code_id" uuid PRIMARY KEY NOT NULL REFERENCES "public"."discount_codes"("id") ON DELETE cascade,
	"category" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_code_categories_length_check" CHECK (char_length("discount_code_categories"."category") between 1 and 60)
);
