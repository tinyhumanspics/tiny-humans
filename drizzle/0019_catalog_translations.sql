CREATE TABLE IF NOT EXISTS "bundle_inclusion_translations" (
	"bundle_id" text NOT NULL,
	"locale" text NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_inclusion_translations_bundle_id_locale_position_pk" PRIMARY KEY("bundle_id","locale","position"),
	CONSTRAINT "bundle_inclusion_translations_locale_check" CHECK ("bundle_inclusion_translations"."locale" in ('es')),
	CONSTRAINT "bundle_inclusion_translations_position_check" CHECK ("bundle_inclusion_translations"."position" between 0 and 11)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bundle_translations" (
	"bundle_id" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"badge" text,
	"offer_label" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_translations_bundle_id_locale_pk" PRIMARY KEY("bundle_id","locale"),
	CONSTRAINT "bundle_translations_locale_check" CHECK ("bundle_translations"."locale" in ('es'))
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bundle_inclusion_translations_bundle_id_bundles_id_fk') THEN
		ALTER TABLE "bundle_inclusion_translations" ADD CONSTRAINT "bundle_inclusion_translations_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END
$$;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bundle_translations_bundle_id_bundles_id_fk') THEN
		ALTER TABLE "bundle_translations" ADD CONSTRAINT "bundle_translations_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END
$$;
