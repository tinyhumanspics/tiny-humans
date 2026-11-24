-- Owner, Nov 24: shoots whose bundle includes the family get a "Family photos" inspo list. The group check gets
-- 'family' added; no row changes. Safe to run twice.
-- destructive-ok: only replaces the shoot_inspo group check with a wider one (adds 'family'); no data is removed (owner asked for this, Nov 24)
ALTER TABLE "shoot_inspo" DROP CONSTRAINT IF EXISTS "shoot_inspo_group_check";--> statement-breakpoint
ALTER TABLE "shoot_inspo" ADD CONSTRAINT "shoot_inspo_group_check" CHECK ("shoot_inspo"."group" in ('inspo', 'bts', 'family'));
