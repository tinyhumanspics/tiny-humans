// Local test database for Tiny Humans (development only).
//
// Starts an embedded Postgres, applies every migration in ../../drizzle (in journal order), seeds data that
// mirrors production's bundles, and serves a small Neon-HTTP-compatible endpoint so the app's
// `drizzle-orm/neon-http` code runs unchanged. Point the app at it with (in .env.local):
//   DATABASE_URL=postgres://tiny:tiny@localhost:5433/tinyhumans
//   NEON_LOCAL_FETCH_ENDPOINT=http://localhost:4444/sql
// Usage: cd scripts/local-db && npm install && node start.mjs [--reset]
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const dataDir = process.env.LOCAL_DB_DIR ?? path.join(here, ".data"); // when running as root, use a dir the "postgres" user can write
const PG_PORT = 5433;
const HTTP_PORT = 4444;
const reset = process.argv.includes("--reset");

if (reset) fs.rmSync(dataDir, { recursive: true, force: true });
const fresh = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
const server = new EmbeddedPostgres({ databaseDir: dataDir, user: "tiny", password: "tiny", port: PG_PORT, persistent: true });
if (fresh) await server.initialise();
await server.start();
if (fresh) await server.createDatabase("tinyhumans");

const pool = new pg.Pool({ host: "localhost", port: PG_PORT, user: "tiny", password: "tiny", database: "tinyhumans", max: 8 });

// --- migrations (tracked in a local table; never touches production) ---
await pool.query(`create table if not exists _local_migrations (tag text primary key, applied_at timestamptz default now())`);
const journal = JSON.parse(fs.readFileSync(path.join(root, "drizzle/meta/_journal.json"), "utf8"));
for (const { tag } of journal.entries) {
  const done = await pool.query("select 1 from _local_migrations where tag = $1", [tag]);
  if (done.rowCount) continue;
  const sql = fs.readFileSync(path.join(root, "drizzle", `${tag}.sql`), "utf8");
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const stmt of sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) await client.query(stmt);
    await client.query("insert into _local_migrations (tag) values ($1)", [tag]);
    await client.query("commit");
    console.log(`migrated ${tag}`);
  } catch (e) {
    await client.query("rollback");
    console.error(`migration ${tag} failed:`, e.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

// --- seed: mirror production's live bundles (first run only) ---
if (fresh || reset) {
  await pool.query(`
    update bundles set regular_price_cents = 14900, duration_minutes = 60, duration_label = 'Up to 1 hour', photos_label = '8' where id = 'little-moments';
    update bundles set regular_price_cents = 24900, duration_minutes = 120, duration_label = 'Up to 2 hours', photos_label = '20', badge = 'Most loved' where id = 'our-little-story';
    update bundles set name = 'Our Family Story', regular_price_cents = 39900, duration_minutes = 180, duration_label = 'Up to 3 hours', photos_label = '35' where id = 'forever-little';
    delete from bundle_inclusions;
    insert into bundle_inclusions (bundle_id, position, text) values
      ('little-moments', 0, 'Up to 1 hour'), ('little-moments', 1, 'Baby only'), ('little-moments', 2, '1 setup'), ('little-moments', 3, '8 edited digital photos'),
      ('our-little-story', 0, 'Up to 2 hours'), ('our-little-story', 1, 'Baby only'), ('our-little-story', 2, '2 setups'), ('our-little-story', 3, '20 edited digital photos'),
      ('forever-little', 0, 'Up to 3 hours'), ('forever-little', 1, 'Baby + parents + siblings'), ('forever-little', 2, '3 setups'), ('forever-little', 3, '35 edited digital photos');
  `);
  console.log("seeded bundles (mirror of production, 2026-10-06)");
}

// --- Neon HTTP shim: POST /sql {query, params} | {queries: [...]} -> {fields, rows, command, rowCount} ---
const ERROR_FIELDS = ["severity", "code", "detail", "hint", "position", "internalPosition", "internalQuery", "where", "schema", "table", "column", "dataType", "constraint", "file", "line", "routine"];
const raw = { getTypeParser: () => (v) => v };
const run = (client, q) =>
  client.query({ text: q.query, values: q.params ?? [], rowMode: "array", types: raw }).then((r) => ({
    fields: (r.fields ?? []).map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    rows: r.rows ?? [],
    command: r.command,
    rowCount: r.rowCount,
  }));

http
  .createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const send = (status, data) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    let payload;
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      return send(400, { message: "bad json" });
    }
    if (process.env.LOCAL_DB_DOWN === "1" || fs.existsSync(path.join(here, ".down"))) return send(503, { message: "simulated outage" });
    const client = await pool.connect();
    try {
      if (Array.isArray(payload.queries)) {
        const iso = req.headers["neon-batch-isolation-level"];
        await client.query(`begin${iso ? ` isolation level ${String(iso).replace(/[^A-Za-z ]/g, "").replace(/([a-z])([A-Z])/g, "$1 $2")}` : ""}`);
        const results = [];
        for (const q of payload.queries) results.push(await run(client, q));
        await client.query("commit");
        send(200, { results });
      } else {
        send(200, await run(client, payload));
      }
    } catch (e) {
      if (Array.isArray(payload.queries)) await client.query("rollback").catch(() => {});
      const out = { message: e.message };
      for (const k of ERROR_FIELDS) if (e[k] !== undefined) out[k] = e[k];
      send(400, out);
    } finally {
      client.release();
    }
  })
  .listen(HTTP_PORT, () => console.log(`local DB ready: postgres://tiny:tiny@localhost:${PG_PORT}/tinyhumans · Neon HTTP shim http://localhost:${HTTP_PORT}/sql`));

const stop = async () => {
  await pool.end().catch(() => {});
  await server.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
