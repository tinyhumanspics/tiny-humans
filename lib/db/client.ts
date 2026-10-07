import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Neon database client (HTTP driver: ideal for Vercel serverless functions).
 * Created lazily so builds and mock mode work without DATABASE_URL.
 */
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // Local development only: scripts/local-db serves a Neon-compatible HTTP endpoint for a local Postgres.
    const local = process.env.NEON_LOCAL_FETCH_ENDPOINT;
    if (local && !process.env.VERCEL) neonConfig.fetchEndpoint = local;
    db = drizzle(neon(url), { schema });
  }
  return db;
}

/** True when a Postgres unique constraint was violated (code 23505). */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    const x = e as { code?: string; constraint?: string; message?: string; cause?: unknown };
    if (x.code === "23505") return constraint ? x.constraint === constraint || Boolean(x.message?.includes(constraint)) : true;
    e = x.cause;
  }
  return false;
}
