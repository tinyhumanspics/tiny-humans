import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db/client";
import { BookingError } from "@/lib/booking/errors";
import { releaseByFamily } from "@/lib/deposit/flow";
import { depositLinkReference } from "@/lib/deposit/request";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";
import en from "@/messages/en.json";

export const dynamic = "force-dynamic";

/** POST /api/booking/deposit/release { b, k }: "Pick another time" — closes the deposit page and frees the time now. */
export async function POST(req: Request) {
  if (!(await allow("depositPost", clientIp(req)))) return NextResponse.json({ error: "Too many requests. Please wait a few minutes.", code: "rate_limited" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { b?: unknown; k?: unknown } | null;
  const reference = depositLinkReference(body?.b, body?.k);
  if (!reference || !isDatabaseConfigured()) return NextResponse.json({ state: "invalid" });
  try {
    return NextResponse.json(await releaseByFamily(reference), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    log.error("api.deposit", "Release failed", { reference, error: err as Error });
    return NextResponse.json({ error: en.deposit.return.error, code: "server_error" }, { status: 500 });
  }
}
