import { NextResponse } from "next/server";
import { hasPasskeys } from "@/lib/admin/passkeys";
import { allow, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Public: whether the sign-in page should offer Face ID / Touch ID (a device has been set up). */
export async function GET(req: Request) {
  if (!(await allow("passkeyLogin", clientIp(req)))) return NextResponse.json({ available: false }, { status: 429 });
  const available = await hasPasskeys().catch(() => false);
  return NextResponse.json({ available }, { headers: { "cache-control": "no-store" } });
}
