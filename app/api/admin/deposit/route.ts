import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { LANDING_PATH } from "@/config/landing";
import { isAdmin } from "@/lib/admin/auth";
import { guardAvailability } from "@/lib/availability/api";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getDepositSettings, isMissingTable, saveDepositSettings } from "@/lib/deposit/server";
import { log } from "@/lib/log";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { getCatalog } from "@/lib/pricing/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  enabled: z.boolean(),
  /** bundle id → deposit (cents) */
  amounts: z.record(z.string().min(1).max(64), z.number().int().min(100, "Each deposit must be at least $1.").max(100000, "A deposit can be $1,000 at most.")),
});

/** Stripe can take deposits (the key) and confirm them (the return links + manage links are signed with this secret). */
const stripeReady = () => isStripeConfigured() && Boolean(process.env.ADMIN_SESSION_SECRET);

/** Owner only: deposits on/off + each bundle's amount. */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ settings: await getDepositSettings(), stripeReady: stripeReady(), databaseConfigured: isDatabaseConfigured() });
}

/** Owner only: save deposits (new bookings only). The landing page, About page and Terms mention them. */
export async function PUT(req: Request) {
  const blocked = await guardAvailability();
  if (blocked) return blocked;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the deposit." }, { status: 400 });
  if (parsed.data.enabled && !stripeReady()) return NextResponse.json({ error: "Stripe isn't connected yet (STRIPE_SECRET_KEY in Vercel), so deposits can't be turned on." }, { status: 400 });
  const known = new Set((await getCatalog()).map((b) => b.id));
  if (Object.keys(parsed.data.amounts).some((id) => !known.has(id))) return NextResponse.json({ error: "That bundle doesn't exist anymore. Reload the page." }, { status: 400 });
  try {
    await saveDepositSettings(parsed.data);
  } catch (err) {
    const missing = isMissingTable(err);
    log.error("deposit.admin", "save failed", { error: new Error((err as { cause?: Error }).cause?.message ?? "query failed") });
    return NextResponse.json({ error: missing ? "The deposit table doesn't exist yet. Run drizzle/0014_booking_deposits.sql in Neon." : "Couldn't save. Please try again." }, { status: missing ? 503 : 500 });
  }
  // pages that mention the deposit
  for (const path of ["/terms", "/about", LANDING_PATH]) revalidatePath(path);
  log.info("deposit.admin", "Deposit setting saved", parsed.data);
  return NextResponse.json({ settings: await getDepositSettings(), stripeReady: stripeReady() });
}
