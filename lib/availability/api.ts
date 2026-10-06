import "server-only";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { log } from "@/lib/log";

/** Shared guard for the owner-only availability routes. Returns a response to send, or null to continue. */
export async function guardAvailability(): Promise<NextResponse | null> {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "The database isn't connected yet. Add DATABASE_URL in Vercel and run the Neon migration." }, { status: 503 });
  }
  return null;
}

export function availabilityError(err: unknown, action: string): NextResponse {
  log.error("availability.admin", `${action} failed`, { error: err as Error });
  const missing = JSON.stringify(err ?? "").includes("42P01") || String((err as Error)?.message ?? "").includes("does not exist");
  return NextResponse.json(
    { error: missing ? "The availability tables don't exist yet. Run drizzle/0001_owner_availability.sql in Neon." : "Couldn't save. Please try again." },
    { status: missing ? 503 : 500 },
  );
}
