import { NextResponse } from "next/server";
import { removeShootFiles } from "@/lib/shoots/files";
import { NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { deleteSignaturePhoto } from "@/lib/shoots/server";
import { uuidSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; photoId: string }> };

/** Owner only: removes one photo of a signature pose (the file, then the row). */
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const p = await params;
  const id = await parsed(uuidSchema, p.id);
  if ("response" in id) return id.response;
  const photoId = await parsed(uuidSchema, p.photoId);
  if ("response" in photoId) return photoId.response;
  try {
    await deleteSignaturePhoto(id.data, photoId.data, removeShootFiles);
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "pose photo remove");
  }
}
