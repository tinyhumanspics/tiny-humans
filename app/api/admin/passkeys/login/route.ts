import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { isAuthConfigured, newSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/admin/auth";
import { completeAuthentication } from "@/lib/admin/passkeys";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";
import { TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };

// The library checks the full structure and the signature; this only bounds what reaches it.
const body = z.object({ response: z.object({ id: z.string().min(8).max(1024), type: z.literal("public-key") }).passthrough() });

/** Step 2 of "Sign in with Face ID / Touch ID": a verified passkey gets the same session as the password. */
export async function POST(req: Request) {
  if (!isAuthConfigured()) return NextResponse.json({ error: "The owner sign-in isn't set up yet." }, { status: 503 });
  if (!(await allow("passkeyLogin", clientIp(req))) || !(await allow("adminLoginGlobal", "all"))) {
    return NextResponse.json({ error: "Too many sign-in attempts. Please wait 15 minutes and try again." }, { status: 429 });
  }
  const raw = await readJson(req, 16 * 1024);
  if (raw === TOO_LARGE) return tooLargeResponse(NO_STORE);
  const parsed = body.safeParse(raw);
  const failed = () => NextResponse.json({ error: "That didn't work. Try again, or use the password." }, { status: 401, headers: NO_STORE });
  if (!parsed.success) return failed();
  try {
    if (!(await completeAuthentication(req, parsed.data.response as unknown as AuthenticationResponseJSON))) return failed();
  } catch (err) {
    log.error("admin.passkey", "Sign-in failed", { error: err as Error });
    return NextResponse.json({ error: "Something went wrong. Please use the password." }, { status: 500, headers: NO_STORE });
  }
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set(SESSION_COOKIE, await newSessionToken(), sessionCookieOptions());
  return res;
}
