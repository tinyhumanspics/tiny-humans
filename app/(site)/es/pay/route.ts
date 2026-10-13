import { paymentRoute } from "@/lib/payments/http";

export const dynamic = "force-dynamic";

/** Spanish payment entry route; a valid booking always wins if its stored locale differs. */
export async function GET(req: Request) {
  return paymentRoute(req, "es");
}
