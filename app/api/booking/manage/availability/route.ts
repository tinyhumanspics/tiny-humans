import { NextResponse } from "next/server";
import { z } from "zod";
import { getBookingProvider } from "@/lib/booking/server";
import { NO_STORE, invalidLink, manageFail, tokenOk, tooMany } from "@/lib/booking/manage-api";
import { allow, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const range = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).refine((q) => q.from <= q.to && (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 62);

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
