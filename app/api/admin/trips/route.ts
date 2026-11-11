import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { guardAvailability } from "@/lib/availability/api";
import { log } from "@/lib/log";
import { getTripSettings, saveTripSettings } from "@/lib/booking/trips-server";

export const dynamic = "force-dynamic";

const schema = z.object({
  enabled: z.boolean(),
  tripMiles: z.number().int().min(10, "Trip distance: at least 10 miles.").max(1000),
  sameTripMiles: z.number().int().min(1, "Same-trip distance: at least 1 mile.").max(200, "Same-trip distance: 200 miles at most."),
  nextDayUntil: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick the time the next day opens."),
});

/** Owner only: trip-day rules (Availability → Travel). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ settings: await getTripSettings() }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(req: Request) {
  const blocked = await guardAvailability();
  if (blocked) return blocked;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the trip-day settings." }, { status: 400 });
  try {
    await saveTripSettings(parsed.data);
  } catch (err) {
    log.error("trips.admin", "save failed", { error: err as Error });
    const missing = JSON.stringify(err ?? "").includes("42P01") || String((err as Error)?.message ?? "").includes("does not exist");
    return NextResponse.json({ error: missing ? "The trip-day table isn't in the database yet. Run drizzle/0027_trip_settings.sql in Neon." : "Couldn't save. Please try again." }, { status: missing ? 503 : 500 });
  }
  return NextResponse.json({ settings: await getTripSettings() });
}
