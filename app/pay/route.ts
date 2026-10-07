import { NextResponse } from "next/server";
import { site } from "@/config/site";
import { isDatabaseConfigured } from "@/lib/db/client";
import { bookingForPayLink, openPayment } from "@/lib/payments/server";
import { allow, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const status = (s: string) => NextResponse.redirect(`${site.url.replace(/\/$/, "")}/pay/status?s=${s}`, { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });

/**
 * GET /pay?b=<reference>&s=<signature> (the booking's payment link, never expires) or /pay?t=<token> (older email
 * links): sends the family to Stripe for the exact booked amount.
 */
export async function GET(req: Request) {
  if (!(await allow("pay", clientIp(req)))) return status("error");
  if (!isDatabaseConfigured()) return status("error");
  const q = new URL(req.url).searchParams;
  const outcome = await openPayment(await bookingForPayLink({ reference: q.get("b"), signature: q.get("s"), token: q.get("t") }).catch(() => null));
  if ("redirect" in outcome) return NextResponse.redirect(outcome.redirect, { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  return status(outcome.status);
}
