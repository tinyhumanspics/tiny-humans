import { paymentRoute } from "@/lib/payments/http";

export const dynamic = "force-dynamic";

/**
 * GET /pay?b=<reference>&s=<signature> (the booking's payment link, never expires) or /pay?t=<token> (older email
 * links): sends the family to Stripe for the exact booked amount.
 */
export async function GET(req: Request) {
  return paymentRoute(req, "en");
}
