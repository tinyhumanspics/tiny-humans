import { NextResponse } from "next/server";
import { bodyOf, NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { deleteInspo, updateInspo } from "@/lib/shoots/server";
import { removeShootFiles } from "@/lib/shoots/files";
import { inspoPatchSchema, uuidSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; inspoId: string }> };

/** Owner only: "What's the shot?" / "What's the idea?" */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const id = await parsed(uuidSchema, (await params).inspoId);
  if ("response" in id) return id.response;
  const patch = await parsed(inspoPatchSchema, await bodyOf(req));
  if ("response" in patch) return patch.response;
  try {
    return NextResponse.json({ item: await updateInspo(id.data, patch.data) }, { headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "inspo caption");
  }
}

/** Owner only: remove an item (its photo file first, then the row and its tick). */
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const id = await parsed(uuidSchema, (await params).inspoId);
  if ("response" in id) return id.response;
  try {
    await deleteInspo(id.data, removeShootFiles);
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "inspo remove");
  }
}
