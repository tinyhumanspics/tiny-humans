import { NextResponse } from "next/server";
import { NO_STORE, waiverError, waiverGuard } from "@/lib/waiver/route";
import { getSignedWaiver } from "@/lib/waiver/server";
import { waiverIdSchema } from "@/lib/waiver/validation";

export const dynamic = "force-dynamic";

/** Owner only: a signed release with its exact text and signature ("See signed waiver"). Read-only: no PATCH. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await waiverGuard(req);
  if (blocked) return blocked;
  const id = waiverIdSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Not found." }, { status: 404, headers: NO_STORE });
  try {
    const waiver = await getSignedWaiver(id.data);
    if (!waiver) return NextResponse.json({ error: "That release doesn't exist." }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ waiver }, { headers: NO_STORE });
  } catch (err) {
    return waiverError(err, "view");
  }
}
