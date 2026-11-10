import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAdmin } from "@/lib/admin/auth";
import { bookingRules } from "@/config/booking";
import { isDatabaseConfigured } from "@/lib/db/client";
import { log } from "@/lib/log";
import { todayInZone } from "@/lib/booking/timezone";
import { applyOfferToAll, CATALOG_TAG, endOffersForAll, getAdminCatalog, refreshCatalogSnapshot } from "@/lib/pricing/server";
import { offerForAllSchema } from "@/lib/pricing/validation";
import { toSpanish } from "@/lib/i18n/autotranslate";
import { fit } from "@/lib/i18n/spanish-autofill";

export const dynamic = "force-dynamic";

async function guard() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503 });
  return null;
}
const refresh = async () => {
  try { revalidateTag(CATALOG_TAG, { expire: 0 }); } catch { /* outside a request */ }
  await refreshCatalogSnapshot();
};

/** Owner only: put the same "% off" offer on every active bundle (prices worked out on the server). */
export async function POST(req: Request) {
  const g = await guard(); if (g) return g;
  const p = offerForAllSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the offer." }, { status: 400 });
  if (p.data.endsOn < todayInZone(bookingRules.timeZone)) return NextResponse.json({ error: "The last day can't be in the past." }, { status: 400 });
  const label = p.data.label?.trim() || null;
  try {
    // a blank Spanish label is translated from the English one (owner, Nov 9: Spanish fills itself in)
    const labelEs = label ? p.data.labelEs?.trim() || fit((await toSpanish([label]))[0] ?? label, label, 30) : null;
    const count = await applyOfferToAll({ ...p.data, label, labelEs });
    await refresh();
    return NextResponse.json({ bundles: await getAdminCatalog(), count });
  } catch (err) {
    log.error("admin.pricing", "Offer for every bundle failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't save the offer. Please try again." }, { status: 500 });
  }
}

/** Owner only: end the special offer on every bundle (regular prices again). */
export async function DELETE() {
  const g = await guard(); if (g) return g;
  try {
    await endOffersForAll();
    await refresh();
    return NextResponse.json({ bundles: await getAdminCatalog() });
  } catch (err) {
    log.error("admin.pricing", "Ending every offer failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't end the offers. Please try again." }, { status: 500 });
  }
}
