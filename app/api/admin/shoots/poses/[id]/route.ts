import { NextResponse } from "next/server";
import { removeShootFiles } from "@/lib/shoots/files";
import { bodyOf, NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { deleteSignaturePose, updateSignaturePose } from "@/lib/shoots/server";
import { posePatchSchema, uuidSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Owner only: a pose's name and how to set it up (one step per line). */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const id = await parsed(uuidSchema, (await params).id);
  if ("response" in id) return id.response;
  const patch = await parsed(posePatchSchema, await bodyOf(req));
  if ("response" in patch) return patch.response;
  try {
    await updateSignaturePose(id.data, patch.data);
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "pose save");
  }
}

/** Owner only: "Remove this pose" (after the second tap): its photos, the pose and its ticks. */
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const id = await parsed(uuidSchema, (await params).id);
  if ("response" in id) return id.response;
  try {
    await deleteSignaturePose(id.data, removeShootFiles);
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "pose remove");
  }
}
