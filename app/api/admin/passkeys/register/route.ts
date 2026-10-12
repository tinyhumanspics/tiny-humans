import { NextResponse } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { PasskeyError, completeRegistration, listPasskeys } from "@/lib/admin/passkeys";
import { log } from "@/lib/log";
import { TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";

export const dynamic = "force-dynamic";

// The library checks the full structure and every signature; this only bounds what reaches it.
const body = z.object({ response: z.object({ id: z.string().min(8).max(1024), type: z.literal("public-key") }).passthrough() });

/** Owner only: step 2 of adding Face ID / Touch ID on this device. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const raw = await readJson(req, 16 * 1024);
  if (raw === TOO_LARGE) return tooLargeResponse();
  const parsed = body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "This device couldn't be added. Please try again." }, { status: 400 });
  try {
    const passkey = await completeRegistration(req, parsed.data.response as unknown as RegistrationResponseJSON);
    return NextResponse.json({ passkey, ready: true, passkeys: await listPasskeys() }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof PasskeyError) return NextResponse.json({ error: err.message }, { status: err.status });
    log.error("admin.passkey", "Registration failed", { error: err as Error });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
