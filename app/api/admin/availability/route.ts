import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { LANDING_PATH } from "@/config/landing";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getAvailabilityRules, saveWeeklyAndLimits } from "@/lib/availability/server";
import { weeklyAndLimitsSchema } from "@/lib/availability/validation";
import { availabilityError, guardAvailability } from "@/lib/availability/api";

export const dynamic = "force-dynamic";

/** Owner only: current availability rules (weekly hours, limits, special dates, time blocks). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    return NextResponse.json({ rules: await getAvailabilityRules(), databaseConfigured: isDatabaseConfigured() });
  } catch (err) {
    return availabilityError(err, "load");
  }
}

/** Owner only: save the weekly schedule and booking rules. */
export async function PUT(req: Request) {
  const blocked = await guardAvailability();
  if (blocked) return blocked;
  const parsed = weeklyAndLimitsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the hours and try again." }, { status: 400 });
  try {
    await saveWeeklyAndLimits(parsed.data.weekly, parsed.data.limits);
    // pages that show the cancel/reschedule notice
    revalidatePath("/terms");
    revalidatePath(LANDING_PATH);
    return NextResponse.json({ rules: await getAvailabilityRules() });
  } catch (err) {
    return availabilityError(err, "save weekly");
  }
}
