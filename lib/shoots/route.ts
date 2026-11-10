import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";
import { ShootInputError, ShootNotFoundError, ShootsNotReadyError } from "./server";

/** Shared by every /api/admin/shoots route: owner check, rate limit, input parsing and plain-English errors. */

export const NO_STORE = { "cache-control": "no-store" } as const;

/** Owner signed in and not over the limit; otherwise the response to send back. */
export async function shootsGuard(req: Request): Promise<NextResponse | null> {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: NO_STORE });
  if (!(await allow("adminShoots", clientIp(req)))) {
    return NextResponse.json({ error: "Too many changes at once. Wait a minute and try again." }, { status: 429, headers: NO_STORE });
  }
  return null;
}

/** Parses a JSON body (or query object) with a schema; the first problem becomes a 400. */
export async function parsed<S extends z.ZodType>(schema: S, input: unknown): Promise<{ data: z.output<S> } | { response: NextResponse }> {
  const result = schema.safeParse(input);
  if (result.success) return { data: result.data };
  return { response: NextResponse.json({ error: result.error.issues[0]?.message ?? "Check what you typed." }, { status: 400, headers: NO_STORE }) };
}

export const bodyOf = (req: Request) => req.json().catch(() => null);

/** Known problems → their message; anything else is logged (without values) and reads "try again". */
export function shootsError(err: unknown, scope: string): NextResponse {
  if (err instanceof ShootsNotReadyError) return NextResponse.json({ error: err.message, notReady: true }, { status: 503, headers: NO_STORE });
  if (err instanceof ShootNotFoundError) return NextResponse.json({ error: err.message }, { status: 404, headers: NO_STORE });
  if (err instanceof ShootInputError) return NextResponse.json({ error: err.message }, { status: 400, headers: NO_STORE });
  log.error("admin.shoots", `${scope} failed`, { error: err as Error });
  return NextResponse.json({ error: "Couldn't save that. Please try again." }, { status: 500, headers: NO_STORE });
}
