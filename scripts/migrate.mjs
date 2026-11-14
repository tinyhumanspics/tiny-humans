/**
 * Database migrations in the deploy (brief 01). vercel.json runs this before `next build`:
 * - Production builds (VERCEL_ENV=production) apply every pending drizzle/ migration in ONE transaction. A failure
 *   changes nothing and stops the deploy, so the live site keeps the previous version.
 * - Preview, CI and local builds skip it: the production database is never touched from there.
 * - `--local` runs it against scripts/local-db only (it refuses without NEON_LOCAL_FETCH_ENDPOINT).
 *
 * It keeps Drizzle's own record (drizzle.__drizzle_migrations: sha256 of the file + the journal's `when`), so
 * `drizzle-kit migrate` agrees with it. Migrations up to BASELINE_TAG were run by hand in the Neon console before
 * this existed: the first run checks that every table and column they create exists, records them, and never re-runs
 * them. A pending migration that drops, renames, truncates or deletes stops the deploy unless the file has a
 * `-- destructive-ok: <reason>` line (owner approval first; old code must not need what it removes).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The last migration the owner ran by hand (Nov 11, 2026). Everything after it is applied by the deploy. */
export const BASELINE_TAG = "0032_due_reservation_extras";
/** One deploy migrates at a time (transaction-level advisory lock). */
const LOCK_KEY = 20261114;
const TABLE = "drizzle.__drizzle_migrations";

export const DESTRUCTIVE_MARKER = /^--\s*destructive-ok:\s*\S/m;
const DESTRUCTIVE = [
  /\bdrop\s+(table|column|schema|view|materialized\s+view|constraint|type)\b/i,
  /\brename\s+(to|column|constraint)\b/i,
  /\btruncate\b/i,
  /\bdelete\s+from\b/i,
  /\balter\s+column\s+("[^"]+"|\w+)\s+(set\s+data\s+)?type\b/i,
];

/** SQL without its comments (line and block), so wording in a comment never counts as a statement. */
export function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/** What a migration would destroy, e.g. ["drop column"]; [] when it only adds. */
export function destructiveParts(sql) {
  const body = stripComments(sql);
  return DESTRUCTIVE.map((re) => body.match(re)?.[0]).filter(Boolean).map((m) => m.replace(/\s+/g, " ").toLowerCase());
}

/** The tables and columns a migration creates (to check hand-run migrations really ran). */
export function createdObjects(sql) {
  const body = stripComments(sql);
  const tables = [...body.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?(\w+)"?/gi)].map((m) => m[1]);
  const columns = [];
  for (const m of body.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:"?public"?\.)?"?(\w+)"?([^;]*)/gi)) {
    for (const c of m[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/gi)) columns.push([m[1], c[1]]);
  }
  return { tables, columns };
}

/** A migration file's statements (Drizzle's `--> statement-breakpoint`), without comment-only pieces. */
export function statements(sql) {
  return sql.split("--> statement-breakpoint").filter((s) => stripComments(s).trim());
}

/**
 * What a run does. `entries`: the journal in order ({ tag, when, hash, sql }); `applied`: the rows of Drizzle's table.
 * Like Drizzle, anything at or before the newest recorded `when` counts as applied.
 */
export function plan({ entries, applied, baselineTag = BASELINE_TAG }) {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].when <= entries[i - 1].when) throw new Error(`journal out of order at ${entries[i].tag}`);
  }
  const last = applied.reduce((max, row) => Math.max(max, Number(row.created_at) || 0), 0);
  const baseline = entries.find((e) => e.tag === baselineTag);
  if (!baseline) throw new Error(`baseline ${baselineTag} is not in the journal`);
  const record = entries.filter((e) => e.when > last && e.when <= baseline.when);
  const apply = entries.filter((e) => e.when > Math.max(last, baseline.when));
  const blocked = apply
    .map((e) => ({ tag: e.tag, parts: destructiveParts(e.sql) }))
    .filter((b) => b.parts.length && !DESTRUCTIVE_MARKER.test(entries.find((e) => e.tag === b.tag).sql));
  return { last, record, apply, blocked };
}

/** Tables/columns the migrations being recorded should have created but that the database lacks. */
export function missingObjects(record, existing) {
  const tables = new Set(existing.map((r) => r.table_name));
  const columns = new Set(existing.map((r) => `${r.table_name}.${r.column_name}`));
  const missing = [];
  for (const e of record) {
    const { tables: t, columns: c } = createdObjects(e.sql);
    for (const name of t) if (!tables.has(name)) missing.push(`${e.tag}: table ${name}`);
    for (const [table, column] of c) if (!columns.has(`${table}.${column}`)) missing.push(`${e.tag}: column ${table}.${column}`);
  }
  return missing;
}

/** "run" | "skip" (with why), or throws when it can't tell. Vercel builds run in /vercel/path0. */
export function decide(env, args = [], cwd = process.cwd()) {
  if (args.includes("--local")) {
    if (!env.NEON_LOCAL_FETCH_ENDPOINT) throw new Error("--local needs NEON_LOCAL_FETCH_ENDPOINT (scripts/local-db); it never runs against Neon");
    return { run: true, local: true };
  }
  if ((env.VERCEL === "1" || cwd.startsWith("/vercel/")) && !env.VERCEL_ENV) {
    throw new Error("VERCEL_ENV is missing: turn on \"Automatically expose System Environment Variables\" in Vercel");
  }
  if (env.VERCEL_ENV !== "production") return { run: false, why: env.VERCEL_ENV ? `${env.VERCEL_ENV} build` : "not a Vercel build" };
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set for Production");
  return { run: true, local: false };
}

/** The transaction for a plan: lock, check nobody migrated meanwhile, record the hand-run ones, apply the rest. */
export function transactionQueries(p) {
  const insert = (e) => `INSERT INTO ${TABLE} ("hash", "created_at") VALUES ('${e.hash}', ${e.when})`;
  return [
    `SELECT pg_advisory_xact_lock(${LOCK_KEY})`,
    `DO $$ BEGIN IF (SELECT coalesce(max(created_at), 0) FROM ${TABLE}) <> ${p.last} THEN RAISE EXCEPTION 'Another deploy migrated the database meanwhile: redeploy'; END IF; END $$`,
    ...p.record.map(insert),
    ...p.apply.flatMap((e) => [...statements(e.sql), insert(e)]),
  ];
}

export function readEntries(dir) {
  const journal = JSON.parse(readFileSync(join(dir, "meta", "_journal.json"), "utf8"));
  return journal.entries.map((j) => {
    const sql = readFileSync(join(dir, `${j.tag}.sql`), "utf8");
    return { tag: j.tag, when: j.when, hash: createHash("sha256").update(sql).digest("hex"), sql };
  });
}

async function main() {
  const decision = decide(process.env, process.argv.slice(2));
  if (!decision.run) {
    console.log(`[migrate] skipped (${decision.why}): only production deploys change the production database`);
    return;
  }
  const { neon, neonConfig } = await import("@neondatabase/serverless");
  if (decision.local) neonConfig.fetchEndpoint = process.env.NEON_LOCAL_FETCH_ENDPOINT;
  const sql = neon(process.env.DATABASE_URL);
  const entries = readEntries(fileURLToPath(new URL("../drizzle/", import.meta.url)));

  await sql.transaction([
    sql.query("CREATE SCHEMA IF NOT EXISTS drizzle"),
    sql.query(`CREATE TABLE IF NOT EXISTS ${TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`),
  ]);
  const p = plan({ entries, applied: await sql.query(`SELECT hash, created_at FROM ${TABLE}`) });
  if (p.blocked.length) {
    throw new Error(`destructive migration without a "-- destructive-ok: <reason>" line: ${p.blocked.map((b) => `${b.tag} (${b.parts.join(", ")})`).join("; ")}`);
  }
  if (p.record.length) {
    const existing = await sql.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'");
    const missing = missingObjects(p.record, existing);
    if (missing.length) {
      throw new Error(`hand-run migrations look incomplete (${missing.join("; ")}). Move BASELINE_TAG before that migration so the deploy applies it (its SQL must be safe to run twice).`);
    }
  }
  if (!p.record.length && !p.apply.length) {
    console.log("[migrate] database up to date");
    return;
  }
  await sql.transaction(transactionQueries(p).map((q) => sql.query(q)));
  if (p.record.length) console.log(`[migrate] recorded ${p.record.length} migrations run by hand (through ${p.record.at(-1).tag})`);
  console.log(p.apply.length ? `[migrate] applied: ${p.apply.map((e) => e.tag).join(", ")}` : "[migrate] nothing new to apply");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`[migrate] STOPPED, no migration applied: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
