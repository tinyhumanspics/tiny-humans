import { NextResponse } from "next/server";
import { newSessionToken, SESSION_COOKIE, sessionCookieOptions, sessionSignedInAt } from "@/lib/admin/auth";
import { bumpSessionEpoch } from "@/lib/admin/session-epoch";
import { isDatabaseConfigured, isUndefinedTable } from "@/lib/db/client";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Owner only: "Sign out all other devices". This device gets a fresh session at the new epoch and stays signed in. */
export async function POST() {
  // Read before the epoch changes: the re-issued cookie keeps this session's original sign-in time.
  const signedInAt = await sessionSignedInAt();
  if (signedInAt === null) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const needsUpdate = () => NextResponse.json({ error: "This needs a one-time database update first (migration 0020)." }, { status: 503 });
  if (!isDatabaseConfigured()) return needsUpdate();
  try {
    await bumpSessionEpoch();
  } catch (err) {
    if (isUndefinedTable(err)) {
      return needsUpdate();
    }
    log.error("admin.session", "Sign out other devices failed", { error: err as Error });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, await newSessionToken(signedInAt), sessionCookieOptions());
  return res;
}
