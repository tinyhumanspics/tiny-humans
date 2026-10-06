import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { BookingError } from "@/lib/booking/errors";
import { log } from "@/lib/log";
import { BundleInUseError, CATALOG_TAG, deleteBundle, getCatalog, saveBundle } from "@/lib/pricing/server";
import { bundleInputSchema } from "@/lib/pricing/validation";

export const dynamic = "force-dynamic";

async function guard() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet. Add DATABASE_URL and run the Neon migration." }, { status: 503 });
  return null;
}
const refresh = () => {
  try { revalidateTag(CATALOG_TAG); } catch { /* outside a request */ }
};

/** Owner only: create or update a bundle. */
export async function POST(req: Request) {
  const g = await guard(); if (g) return g;
  const p = bundleInputSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the bundle details." }, { status: 400 });
  try {
    await saveBundle(p.data);
    refresh();
    return NextResponse.json({ bundles: await getCatalog() });
  } catch (err) {
    log.error("admin.pricing", "Save bundle failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't save the bundle. Is the pricing migration (0005) run in Neon?" }, { status: 500 });
  }
}

/** Owner only: permanently delete a bundle (?id=). Refused if any booking used it. */
export async function DELETE(req: Request) {
  const g = await guard(); if (g) return g;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing bundle." }, { status: 400 });
  try {
    await deleteBundle(id);
    refresh();
    return NextResponse.json({ bundles: await getCatalog() });
  } catch (err) {
    if (err instanceof BundleInUseError) return NextResponse.json({ error: err.message }, { status: 409 });
    log.error("admin.pricing", "Delete bundle failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't delete the bundle." }, { status: 500 });
  }
}
