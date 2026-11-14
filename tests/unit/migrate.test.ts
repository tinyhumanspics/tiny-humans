import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BASELINE_TAG,
  createdObjects,
  decide,
  destructiveParts,
  missingObjects,
  plan,
  readEntries,
  statements,
  transactionQueries,
  type Entry,
} from "../../scripts/migrate.mjs";

// Migrations in the deploy (brief 01): scripts/migrate.mjs runs before `next build` on Vercel production builds.
const entries = readEntries(join(process.cwd(), "drizzle"));
const tags = (list: Entry[]) => list.map((e) => e.tag);
const when = (tag: string) => entries.find((e) => e.tag === tag)!.when;
const fake = (tag: string, sql: string, w: number): Entry => ({ tag, when: w, hash: tag, sql });

describe("which deploys migrate", () => {
  it("only production builds; previews, CI and local builds skip", () => {
    expect(decide({ VERCEL: "1", VERCEL_ENV: "production", DATABASE_URL: "postgres://x" })).toEqual({ run: true, local: false });
    expect(decide({ VERCEL: "1", VERCEL_ENV: "preview", DATABASE_URL: "postgres://x" })).toMatchObject({ run: false });
    expect(decide({ VERCEL: "1", VERCEL_ENV: "development", DATABASE_URL: "postgres://x" })).toMatchObject({ run: false });
    expect(decide({ DATABASE_URL: "postgres://x" })).toMatchObject({ run: false });
  });
  it("stops a Vercel build that can't tell which environment it is, or has no database", () => {
    expect(() => decide({ VERCEL: "1" })).toThrow(/VERCEL_ENV/);
    expect(() => decide({}, [], "/vercel/path0")).toThrow(/VERCEL_ENV/);
    expect(() => decide({ VERCEL: "1", VERCEL_ENV: "production" })).toThrow(/DATABASE_URL/);
  });
  it("--local only ever talks to scripts/local-db", () => {
    expect(() => decide({ DATABASE_URL: "postgres://neon" }, ["--local"])).toThrow(/NEON_LOCAL_FETCH_ENDPOINT/);
    expect(decide({ NEON_LOCAL_FETCH_ENDPOINT: "http://localhost:4444/sql" }, ["--local"])).toEqual({ run: true, local: true });
  });
});

describe("the plan", () => {
  it("first run on production: records the hand-run ones (through the baseline) and applies the rest", () => {
    const p = plan({ entries, applied: [] });
    expect(tags(p.record).at(-1)).toBe(BASELINE_TAG);
    expect(p.record).toHaveLength(entries.findIndex((e) => e.tag === BASELINE_TAG) + 1);
    expect(tags(p.apply)).toEqual(tags(entries.filter((e) => e.when > when(BASELINE_TAG))));
    expect(tags(p.apply)).toContain("0035_pipeline_check");
    expect(p.blocked).toEqual([]);
  });
  it("an older Drizzle record: records only what came after it", () => {
    const p = plan({ entries, applied: [{ created_at: String(when("0005_pricing_and_promotions")) }] });
    expect(tags(p.record)[0]).toBe("0006_booking_source");
    expect(tags(p.record).at(-1)).toBe(BASELINE_TAG);
  });
  it("up to date, or a redeploy of older code (database ahead): nothing to do", () => {
    const last = entries.at(-1)!.when;
    expect(plan({ entries, applied: [{ created_at: last }] })).toMatchObject({ record: [], apply: [] });
    expect(plan({ entries, applied: [{ created_at: last + 1000 }] })).toMatchObject({ record: [], apply: [] });
  });
  it("a new migration after the baseline is applied once, in the same transaction as its record", () => {
    const list = [fake("a", "SELECT 1;", 1), fake("b", 'CREATE TABLE "x" (id int);\n--> statement-breakpoint\nCREATE INDEX "x_i" ON "x" (id);', 2)];
    const p = plan({ entries: list, applied: [{ created_at: 1 }], baselineTag: "a" });
    expect(tags(p.apply)).toEqual(["b"]);
    const q = transactionQueries(p);
    expect(q[0]).toMatch(/pg_advisory_xact_lock/);
    expect(q[1]).toMatch(/<> 1 THEN RAISE EXCEPTION/);
    expect(q.slice(2)).toEqual(['CREATE TABLE "x" (id int);\n', '\nCREATE INDEX "x_i" ON "x" (id);', `INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ('b', 2)`]);
  });
  it("refuses a journal out of order", () => {
    expect(() => plan({ entries: [fake("a", "", 2), fake("b", "", 1)], applied: [], baselineTag: "a" })).toThrow(/order/);
  });
});

describe("destructive migrations need a marker", () => {
  it("drops, renames, truncates, deletes and type changes stop the deploy", () => {
    expect(destructiveParts('ALTER TABLE "bookings" DROP COLUMN "x";')).toEqual(["drop column"]);
    expect(destructiveParts('DROP TABLE IF EXISTS "quick_requests";')).toEqual(["drop table"]);
    expect(destructiveParts('ALTER TABLE "a" RENAME TO "b";')).toEqual(["rename to"]);
    expect(destructiveParts('ALTER TABLE "a" ALTER COLUMN "b" SET DATA TYPE text;')).toHaveLength(1);
    expect(destructiveParts("DELETE FROM booking_emails;")).toEqual(["delete from"]);
    const list = [fake("a", "SELECT 1;", 1), fake("b", 'DROP TABLE "old";', 2)];
    expect(plan({ entries: list, applied: [], baselineTag: "a" }).blocked).toEqual([{ tag: "b", parts: ["drop table"] }]);
    const marked = [fake("a", "SELECT 1;", 1), fake("b", '-- destructive-ok: owner confirmed no open rows (Nov 20)\nDROP TABLE "old";', 2)];
    expect(plan({ entries: marked, applied: [], baselineTag: "a" }).blocked).toEqual([]);
  });
  it("comments, cascades and trigger re-creation don't count", () => {
    expect(destructiveParts('-- removing a section moves its shots back (drop table never)\nALTER TABLE "s" ADD COLUMN "x" uuid REFERENCES "t"("id") ON DELETE set null;')).toEqual([]);
    expect(destructiveParts("DROP TRIGGER IF EXISTS t ON bookings; CREATE TRIGGER t BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION f();")).toEqual([]);
  });
  it("no pending migration in drizzle/ is destructive without its marker", () => {
    expect(plan({ entries, applied: [] }).blocked).toEqual([]);
  });
});

describe("checking the hand-run migrations", () => {
  it("reads the tables and columns a migration creates", () => {
    expect(createdObjects('CREATE TABLE IF NOT EXISTS "quick_requests" (\n"id" uuid);\n--> statement-breakpoint\nCREATE INDEX IF NOT EXISTS "q" ON "quick_requests" ("id");')).toEqual({ tables: ["quick_requests"], columns: [] });
    expect(createdObjects('ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "a" text, ADD COLUMN IF NOT EXISTS "b" int;\nALTER TABLE "shoot_inspo" ADD COLUMN "c" uuid;').columns).toEqual([["bookings", "a"], ["bookings", "b"], ["shoot_inspo", "c"]]);
  });
  it("names what's missing", () => {
    const record = [fake("0099_x", 'CREATE TABLE "t" (id int);\nALTER TABLE "u" ADD COLUMN "c" int;', 1)];
    expect(missingObjects(record, [{ table_name: "t", column_name: "id" }, { table_name: "u", column_name: "c" }])).toEqual([]);
    expect(missingObjects(record, [{ table_name: "u", column_name: "id" }])).toEqual(["0099_x: table t", "0099_x: column u.c"]);
  });
  it("every migration up to the baseline creates something to check", () => {
    const record = plan({ entries, applied: [] }).record;
    const empty = record.filter((e) => {
      const o = createdObjects(e.sql);
      return !o.tables.length && !o.columns.length;
    });
    expect(tags(empty)).toEqual([]);
  });
  it("splits Drizzle's statement breakpoints and drops comment-only pieces", () => {
    expect(statements("-- note\n--> statement-breakpoint\nSELECT 1;")).toEqual(["\nSELECT 1;"]);
  });
});
