import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { LANDING_PATH } from "@/config/landing";
import { isAdmin } from "@/lib/admin/auth";
import { guardAvailability } from "@/lib/availability/api";
import { isDatabaseConfigured } from "@/lib/db/client";
import { log } from "@/lib/log";
import { isKnownFloridaZip } from "@/lib/travel/distance";
import { travelExamples } from "@/lib/travel/examples";
import { getTravelSettings, saveTravelSettings } from "@/lib/travel/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  baseZip: z.string().trim().regex(/^\d{5}$/, "Enter your home-base ZIP code (5 digits).").refine(isKnownFloridaZip, "That ZIP code isn't in our Florida list. Try a nearby one."),
  freeMiles: z.number().int().min(0, "Free miles can't be negative.").max(500, "Free miles: 500 at most."),
  perMileCents: z.number().int().min(0, "The price per mile can't be negative.").max(1000, "Price per mile: $10 at most."),
  maxMiles: z.number().int().min(1, "Farthest distance: at least 1 mile.").max(1000, "Farthest distance: 1,000 miles at most."),
});

/** Owner only: travel fee settings + example fees. */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const settings = await getTravelSettings();
  return NextResponse.json({ settings, examples: travelExamples(settings), databaseConfigured: isDatabaseConfigured() });
}

/** Owner only: save the travel fee settings (new bookings use them; the FAQ and Terms show them). */
export async function PUT(req: Request) {
  const blocked = await guardAvailability();
  if (blocked) return blocked;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the travel settings." }, { status: 400 });
  try {
    await saveTravelSettings(parsed.data);
  } catch (err) {
    log.error("travel.admin", "save failed", { error: err as Error });
    const missing = String((err as Error)?.message ?? "").includes("does not exist") || JSON.stringify(err ?? "").includes("42P01");
    return NextResponse.json({ error: missing ? "The travel table doesn't exist yet. Run drizzle/0012_travel_fee.sql in Neon." : "Couldn't save. Please try again." }, { status: missing ? 503 : 500 });
  }
  // pages that show the travel fee
  revalidatePath("/terms");
  revalidatePath(LANDING_PATH);
  const settings = await getTravelSettings();
  return NextResponse.json({ settings, examples: travelExamples(settings) });
}
