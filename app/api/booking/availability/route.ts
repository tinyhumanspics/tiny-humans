import { NextResponse } from "next/server";
import { getBookingProvider } from "@/lib/booking/server";
import { BookingError } from "@/lib/booking/errors";
import { availabilityQuerySchema } from "@/lib/booking/validation";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/booking/availability?bundle=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: Request) {
  if (!(await allow("availability", clientIp(req)))) return NextResponse.json({ error: "Too many requests. Please wait a few minutes and try again.", code: "rate_limited" }, { status: 429, headers: { "cache-control": "no-store" } });
  const url = new URL(req.url);
  const parsed = availabilityQuerySchema.safeParse({
    bundleId: url.searchParams.get("bundle"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  if (!parsed.success) return NextResponse.json({ error: "Please choose a bundle and a valid date range.", code: "invalid_request" }, { status: 400 });
  try {
    const days = await getBookingProvider().getAvailability(parsed.data);
    return NextResponse.json({ days }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    log.error("api.availability", "Unexpected error", { error: err as Error });
    return NextResponse.json({ error: "We couldn't load open times. Please try again.", code: "server_error" }, { status: 500 });
  }
}
