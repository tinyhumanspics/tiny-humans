-- Owner sign-in with Face ID / Touch ID (passkeys) and "Sign out all other devices". Two new tables only: nothing
-- existing changes and it's safe to run twice. Until it runs, /admin keeps working with the password alone and the
-- passkey options stay hidden. admin_passkeys holds public keys only (they can't sign anyone in by themselves).
CREATE TABLE IF NOT EXISTS "admin_auth" (
	"id" smallint PRIMARY KEY NOT NULL,
	"session_epoch" integer DEFAULT 0 NOT NULL,
	"user_handle" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" text,
	"device_type" text NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
