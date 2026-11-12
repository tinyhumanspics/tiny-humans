import { NextResponse } from "next/server";
import { bodyOf, NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { deleteSection, renameSection } from "@/lib/shoots/server";
import { sectionIdSchema, sectionPatchSchema, shootKeySchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; sectionId: string }> };

/** Owner only: rename a section ({ name }). */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const { id, sectionId } = await params;
  const key = await parsed(shootKeySchema, id);
  if ("response" in key) return key.response;
  const section = await parsed(sectionIdSchema, sectionId);
  if ("response" in section) return section.response;
  const patch = await parsed(sectionPatchSchema, await bodyOf(req));
  if ("response" in patch) return patch.response;
  try {
    return NextResponse.json({ section: await renameSection(key.data, section.data, patch.data.name) }, { headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "section rename");
  }
}

/** Owner only: remove a section; its shots go back to the main one. */
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const { id, sectionId } = await params;
  const key = await parsed(shootKeySchema, id);
  if ("response" in key) return key.response;
  const section = await parsed(sectionIdSchema, sectionId);
  if ("response" in section) return section.response;
  try {
    await deleteSection(key.data, section.data);
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "section remove");
  }
}
