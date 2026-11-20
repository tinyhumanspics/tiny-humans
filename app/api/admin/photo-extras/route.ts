import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured, isMissingTable } from "@/lib/db/client";
import { log } from "@/lib/log";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { getExtrasSettings, saveExtrasSettings } from "@/lib/photo-extras/server";

export const dynamic = "force-dynamic";

const dollars = (what: string, max: number) => z.number().int(`${what}: whole cents.`).min(100, `${what}: at least $1.`).max(max, `${what}: too high.`);
const schema = z.object({
  enabled: z.boolean(),
  extraPhotoCents: dollars("Price per extra photo", 100_000),
  maxExtras: z.number().int().min(1, "Most extra photos: at least 1.").max(100, "Most extra photos: 100 at most."),
  fullGalleryCents: dollars("Full gallery price", 1_000_000),
  rawFilesCents: dollars("Unedited files price", 1_000_000),
  openDays: z.number().int().min(1, "Days the page stays open: at least 1.").max(365, "Days the page stays open: 365 at most."),
  extrasDeliveryHours: z.number().int().min(1, "Extra photos delivery: at least 1 hour.").max(720, "Extra photos delivery: 720 hours at most."),
  fullDeliveryDays: z.number().int().min(1, "Full gallery delivery: at least 1 day.").max(90, "Full gallery delivery: 90 days at most."),
  rawDeliveryHours: z.number().int().min(1, "Unedited files delivery: at least 1 hour.").max(720, "Unedited files delivery: 720 hours at most."),
});

/** Owner only: the photo extras settings (/admin → Pricing). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ settings: await getExtrasSettings(), stripeReady: isStripeConfigured(), databaseConfigured: isDatabaseConfigured() });
}

/** Owner only: save them (the next sneak-peek emails and the extras pages use them; earlier orders keep their prices). */
export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the photo extras settings." }, { status: 400 });
  try {
    await saveExtrasSettings(parsed.data);
  } catch (err) {
    log.error("photo-extras.admin", "save failed", { error: err as Error });
    return NextResponse.json({ error: isMissingTable(err) ? "The photo extras table isn't there yet: it's added by the next deploy." : "Couldn't save. Please try again." }, { status: isMissingTable(err) ? 503 : 500 });
  }
  return NextResponse.json({ settings: await getExtrasSettings(), stripeReady: isStripeConfigured() });
}
