import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { log } from "@/lib/log";

/**
 * Rate limiting for public and owner endpoints.
 *
 * Production: Upstash Redis (shared by every Vercel function instance), installed from the Vercel Marketplace,
 * which adds KV_REST_API_URL / KV_REST_API_TOKEN (UPSTASH_REDIS_REST_URL / _TOKEN also work).
 * Without Redis (local development) a per-instance in-memory window is used.
 *
 * Fails OPEN: if Redis is slow or down, requests are allowed — a real parent's booking must never be blocked by
 * the limiter itself. The 256-bit manage-link tokens and the admin password remain the real protection.
 */
export const RULES = {
  availability: { limit: 120, windowSec: 600 },
  quote: { limit: 30, windowSec: 600 },
  // includes the browser's automatic "still saving" retries
  create: { limit: 20, windowSec: 3600 },
  cancelGet: { limit: 30, windowSec: 600 },
  cancelPost: { limit: 10, windowSec: 600 },
  manageGet: { limit: 40, windowSec: 600 },
  managePost: { limit: 10, windowSec: 600 },
  manageAvailability: { limit: 120, windowSec: 600 },
  // owner login: per IP, and across all IPs (slows a distributed password-guessing attempt)
  adminLogin: { limit: 5, windowSec: 900 },
  adminLoginGlobal: { limit: 60, windowSec: 3600 },
} as const;
export type RuleName = keyof typeof RULES;

function redisFromEnv(): Redis | null {
  // Vercel Marketplace names them <PREFIX>_REST_API_URL/_TOKEN (default prefix KV; "STORAGE" if chosen at connect time).
  const env = process.env;
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || env.STORAGE_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || env.STORAGE_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

let redis: Redis | null | undefined;
const limiters = new Map<RuleName, Ratelimit>();
let warned = false;

function limiterFor(name: RuleName): Ratelimit | null {
  if (redis === undefined) redis = redisFromEnv();
  if (!redis) {
    if (!warned && process.env.VERCEL_ENV === "production") {
      warned = true;
      log.warn("rate-limit", "Upstash Redis isn't connected: using per-instance memory limits");
    }
    return null;
  }
  let rl = limiters.get(name);
  if (!rl) {
    const { limit, windowSec } = RULES[name];
    rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`), prefix: `th:rl:${name}`, timeout: 1000, analytics: false, ephemeralCache: new Map() });
    limiters.set(name, rl);
  }
  return rl;
}

/* ---- in-memory fallback (local development) ---- */
const hits = new Map<string, number[]>();
function memoryAllow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  const ok = list.length < limit;
  if (ok) list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return ok;
}

/** True when the request may proceed. `id` is usually the client IP. */
export async function allow(name: RuleName, id: string): Promise<boolean> {
  const rl = limiterFor(name);
  if (!rl) return memoryAllow(`${name}:${id}`, RULES[name].limit, RULES[name].windowSec * 1000);
  try {
    const r = await rl.limit(id);
    if (r.reason === "timeout") log.warn("rate-limit", "Redis timeout: request allowed", { rule: name });
    if (!r.success) log.warn("rate-limit", "Limited", { rule: name });
    return r.success;
  } catch (err) {
    log.error("rate-limit", "Redis error: request allowed", { rule: name, error: err as Error });
    return true;
  }
}

/** Client IP as Vercel reports it (Vercel sets x-forwarded-for; clients can't spoof the first entry there). */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
