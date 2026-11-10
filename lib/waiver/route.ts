import "server-only";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";
import { WaiverInputError, WaiverNotFoundError, WaiverNotReadyError } from "./server";

export const NO_STORE = { "cache-control": "no-store" } as const;

/** Owner signed in and not over the limit; otherwise the response to send back. */
export async function waiverGuard(req: Request): Promise<NextResponse | null> {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in to the owner area first." }, { status: 401, headers: NO_STORE });
  if (!(await allow("adminWaiver", clientIp(req)))) return NextResponse.json({ error: "Too many tries. Wait a minute and try again." }, { status: 429, headers: NO_STORE });
  return null;
}

export function waiverError(err: unknown, scope: string): NextResponse {
  if (err instanceof WaiverNotReadyError) return NextResponse.json({ error: err.message, notReady: true }, { status: 503, headers: NO_STORE });
  if (err instanceof WaiverNotFoundError) return NextResponse.json({ error: err.message }, { status: 404, headers: NO_STORE });
  if (err instanceof WaiverInputError) return NextResponse.json({ error: err.message }, { status: 400, headers: NO_STORE });
  log.error("admin.waiver", `${scope} failed`, { error: err as Error });
  return NextResponse.json({ error: "Couldn't save the release. Please try again." }, { status: 500, headers: NO_STORE });
}
