import { NextResponse } from "next/server";
import { site } from "@/config/site";
import { isDatabaseConfigured } from "@/lib/db/client";
import { openPayment } from "@/lib/payments/server";
import { allow, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const status = (s: string) => NextResponse.redirect(`${site.url.replace(/\/$/, "")}/pay/status?s=${s}`, { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });

/** GET /pay?t=<token> (link in the after-session and gallery emails): sends the family to Stripe for the exact amount. */
export async function GET(req: Request) {
  if (!(await allow("pay", clientIp(req)))) return status("error");
  if (!isDatabaseConfigured()) return status("error");
  const outcome = await openPayment(new URL(req.url).searchParams.get("t") ?? "");
  if ("redirect" in outcome) return NextResponse.redirect(outcome.redirect, { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  return status(outcome.status);
}
