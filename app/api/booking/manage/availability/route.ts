import { NextResponse } from "next/server";
import { z } from "zod";
import { getBookingProvider } from "@/lib/booking/server";
import { NO_STORE, invalidLink, manageFail, tokenOk, tooMany } from "@/lib/booking/manage-api";
import { allow, clientIp } from "@/lib/rate-limit";
import { daysBetweenDateKeys, isDateKey } from "@/lib/validation/date-key";

export const dynamic = "force-dynamic";
const range = z
  .object({ from: z.string().refine(isDateKey), to: z.string().refine(isDateKey) })
  .refine((q) => q.from <= q.to && (daysBetweenDateKeys(q.from, q.to) ?? Infinity) <= 62);

/** GET ?token=&from=&to= : open times for moving THIS booking (it never blocks itself). */
export async function GET(req: Request) {
  if (!(await allow("manageAvailability", clientIp(req)))) return tooMany();
  const u = new URL(req.url);
  const token = u.searchParams.get("token");
  if (!tokenOk(token)) return invalidLink();
  const q = range.safeParse({ from: u.searchParams.get("from"), to: u.searchParams.get("to") });
  if (!q.success) return NextResponse.json({ error: "Choose a valid date range.", code: "invalid_request" }, { status: 400, headers: NO_STORE });
  try {
    return NextResponse.json({ days: await getBookingProvider().getRescheduleAvailability(token, q.data.from, q.data.to) }, { headers: NO_STORE });
  } catch (err) {
    return manageFail(err, "api.manage.availability");
  }
}
