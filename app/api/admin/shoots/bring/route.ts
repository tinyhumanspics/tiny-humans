import { NextResponse } from "next/server";
import { bodyOf, NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { createBringSection, listBringSections } from "@/lib/shoots/server";
import { newBringSectionSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

/** Owner only: What we always bring (every section, in order). */
export async function GET(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  try {
    return NextResponse.json({ sections: await listBringSections() }, { headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "bring list");
  }
}

/** Owner only: "+ Add a section" (an empty card at the end). */
export async function POST(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const input = await parsed(newBringSectionSchema, (await bodyOf(req)) ?? {});
  if ("response" in input) return input.response;
  try {
    return NextResponse.json({ section: await createBringSection(input.data.name) }, { status: 201, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "bring add");
  }
}
