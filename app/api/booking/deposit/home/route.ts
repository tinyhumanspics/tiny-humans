import { after, NextResponse } from "next/server";
import { z } from "zod";
import { isDatabaseConfigured } from "@/lib/db/client";
import { afterBackdropChange } from "@/lib/booking/backdrop-page";
import { BookingError } from "@/lib/booking/errors";
import { homeInput } from "@/lib/booking/validation";
import { saveLinkHome } from "@/lib/deposit/flow";
import { depositLinkReference } from "@/lib/deposit/request";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";
import { BODY_LIMITS, TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";
import en from "@/messages/en.json";

export const dynamic = "force-dynamic";

/**
 * POST /api/booking/deposit/home { b, k, home, babies? }: a family adds their home address on the link the owner sent them,
 * right after the deposit (decision #22), so /admin's Directions opens their door; each baby's age (required, owner
 * Nov 20) and, optionally, the name and boy or girl (owner, Nov 19). A paid booking's Outlook event follows.
 */
const babiesInput = z.array(z.object({ name: z.string().trim().max(80).optional(), gender: z.enum(["boy", "girl", ""]).optional(), age: z.string().max(40).optional() })).max(3).optional();

export async function POST(req: Request) {
  if (!(await allow("depositPost", clientIp(req)))) return NextResponse.json({ error: "Too many requests. Please wait a few minutes.", code: "rate_limited" }, { status: 429 });
  const input = await readJson(req, BODY_LIMITS.small);
  if (input === TOO_LARGE) return tooLargeResponse();
  const body = input as { b?: unknown; k?: unknown; home?: unknown; babies?: unknown } | null;
  const reference = depositLinkReference(body?.b, body?.k);
  const home = homeInput.safeParse(body?.home);
  if (!reference || !isDatabaseConfigured()) return NextResponse.json({ error: en.bookingFlow.depositReturn.invalidTitle, code: "invalid_request" }, { status: 400 });
  if (!home.success) return NextResponse.json({ error: home.error.issues[0]?.message ?? "Add your street address and city.", code: "invalid_request" }, { status: 400 });
  const babies = babiesInput.safeParse(body?.babies);
  if (!babies.success) return NextResponse.json({ error: en.bookingFlow.depositReturn.error, code: "invalid_request" }, { status: 400 });
  try {
    const saved = await saveLinkHome(reference, home.data, babies.data);
    // the calendar event (once paid) gets the address; same picks before and after, so no backdrop email
    after(() => afterBackdropChange(saved.row, [], []));
    return NextResponse.json({ home: saved.home, babies: saved.babies }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    log.error("api.deposit", "Link home not saved", { reference, error: err as Error });
    return NextResponse.json({ error: en.bookingFlow.depositReturn.error, code: "server_error" }, { status: 500 });
  }
}
