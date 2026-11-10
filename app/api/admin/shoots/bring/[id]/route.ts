import { NextResponse } from "next/server";
import { bodyOf, NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { deleteBringSection, updateBringSection } from "@/lib/shoots/server";
import { bringSectionPatchSchema, uuidSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Owner only: rename a section, change its items (one per line) or its place in the list. */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const id = await parsed(uuidSchema, (await params).id);
  if ("response" in id) return id.response;
  const patch = await parsed(bringSectionPatchSchema, await bodyOf(req));
  if ("response" in patch) return patch.response;
  try {
    return NextResponse.json({ section: await updateBringSection(id.data, patch.data) }, { headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "bring save");
  }
}

/** Owner only: "Remove this section" (after the second tap). */
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const id = await parsed(uuidSchema, (await params).id);
  if ("response" in id) return id.response;
  try {
    await deleteBringSection(id.data);
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "bring remove");
  }
}
