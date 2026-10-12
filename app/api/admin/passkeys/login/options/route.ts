import { NextResponse } from "next/server";
import { PasskeyError, authenticationOptions } from "@/lib/admin/passkeys";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Step 1 of "Sign in with Face ID / Touch ID". */
export async function POST(req: Request) {
  if (!(await allow("passkeyLogin", clientIp(req)))) {
    return NextResponse.json({ error: "Too many sign-in attempts. Please wait 15 minutes and try again." }, { status: 429 });
  }
  try {
    return NextResponse.json(await authenticationOptions(req), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof PasskeyError) return NextResponse.json({ error: err.message }, { status: err.status });
    log.error("admin.passkey", "Sign-in options failed", { error: err as Error });
    return NextResponse.json({ error: "Something went wrong. Please use the password." }, { status: 500 });
  }
}
