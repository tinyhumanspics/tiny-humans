import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_FAMILY_MEMBERS } from "@/config/booking";
import { isAdmin } from "@/lib/admin/auth";
import { log } from "@/lib/log";
import { CatalogUnavailableError } from "@/lib/pricing/server";
import { buildQuote } from "@/lib/quotes/server";

export const dynamic = "force-dynamic";

const query = z.object({
  zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP code."),
  babies: z.coerce.number().int().min(1).max(3).default(1),
  family: z.coerce.number().int().min(0).max(MAX_FAMILY_MEMBERS).default(0),
  /** The owner's % off for this quote (0 = none). */
  percent: z.coerce.number().int("Use a whole percent, like 10.").min(0).max(90, "90% off at most.").default(0),
});

/** Owner only: every bundle's price for a ZIP code today (GET ?zip=33326&babies=1&family=0&percent=10). */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const p = query.safeParse({ zip: params.get("zip") ?? "", babies: params.get("babies") ?? undefined, family: params.get("family") ?? undefined, percent: params.get("percent") || undefined });
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the ZIP code." }, { status: 400 });
  try {
    return NextResponse.json(await buildQuote(p.data.zip, p.data.babies, p.data.family, p.data.percent), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (!(err instanceof CatalogUnavailableError)) log.error("admin.quote", "Quote failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't load the bundles just now. Please try again." }, { status: 500 });
  }
}
