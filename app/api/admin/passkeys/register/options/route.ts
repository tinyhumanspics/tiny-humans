import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { PasskeyError, registrationOptions } from "@/lib/admin/passkeys";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Owner only: step 1 of adding Face ID / Touch ID on this device. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    return NextResponse.json(await registrationOptions(req), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof PasskeyError) return NextResponse.json({ error: err.message }, { status: err.status });
    log.error("admin.passkey", "Registration options failed", { error: err as Error });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
