import { NextResponse } from "next/server";
import { z } from "zod";
import { BookingError } from "@/lib/booking/errors";
import { payDueAgain } from "@/lib/due-date/server";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

export const dynamic = "force-dynamic";

const body = z.object({ r: z.string().trim().max(40), k: z.string().trim().max(40), locale: z.enum(["en", "es"]).optional() });

/**
 * POST /api/due-date/pay: "Pay the deposit" on a family's reservation page (owner, Nov 11: back from Stripe without
 * paying, or from the automatic email). Signed link (r + k); answers with a fresh Stripe page for the saved reservation.
 */
export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null));
  const t = (p.success && p.data.locale === "es" ? es : en).dueDate;
  if (!(await allow("due", clientIp(req)))) return NextResponse.json({ error: t.errors.rateLimited, code: "rate_limited" }, { status: 429 });
  if (!p.success) return NextResponse.json({ error: t.done.payError, code: "invalid_request" }, { status: 400 });
  try {
    return NextResponse.json({ depositUrl: await payDueAgain(p.data.r, p.data.k, p.data.locale) });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: t.done.payError, code: err.code }, { status: err.status });
    log.error("api.due.pay", "Unexpected error", { error: err as Error });
    return NextResponse.json({ error: t.done.payError, code: "server_error" }, { status: 500 });
  }
}
