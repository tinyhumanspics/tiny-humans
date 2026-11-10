import { NextResponse } from "next/server";
import { NO_STORE, waiverError, waiverGuard } from "@/lib/waiver/route";
import { signWaiver, waiverContext } from "@/lib/waiver/server";
import { referenceSchema, signSchema } from "@/lib/waiver/validation";

export const dynamic = "force-dynamic";

/** Owner only: what the signing screen shows about a booking (?ref=TH-…). */
export async function GET(req: Request) {
  const blocked = await waiverGuard(req);
  if (blocked) return blocked;
  const ref = referenceSchema.safeParse(new URL(req.url).searchParams.get("ref"));
  if (!ref.success) return NextResponse.json({ error: "That booking reference isn't right." }, { status: 400, headers: NO_STORE });
  try {
    return NextResponse.json({ context: await waiverContext(ref.data) }, { headers: NO_STORE });
  } catch (err) {
    return waiverError(err, "context");
  }
}

/** Owner only (the iPad, signed in): the parent tapped Done. Saves the release and updates the lead's Photo use. */
export async function POST(req: Request) {
  const blocked = await waiverGuard(req);
  if (blocked) return blocked;
  const length = Number(req.headers.get("content-length"));
  if (Number.isFinite(length) && length > 200_000) return NextResponse.json({ error: "That signature is too large." }, { status: 413, headers: NO_STORE });
  const parsed = signSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the form." }, { status: 400, headers: NO_STORE });
  try {
    return NextResponse.json({ saved: await signWaiver(parsed.data, req.headers.get("user-agent")) }, { status: 201, headers: NO_STORE });
  } catch (err) {
    return waiverError(err, "sign");
  }
}
