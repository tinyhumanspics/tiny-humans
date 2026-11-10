import { NextResponse } from "next/server";
import { bodyOf, NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { deleteStyledShoot, getShoot, updateShoot } from "@/lib/shoots/server";
import { removeShootFiles } from "@/lib/shoots/files";
import { shootKeySchema, shootPatchSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Owner only: a shoot's folder ("b-<booking reference>" or the shoot's id). */
export async function GET(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const key = await parsed(shootKeySchema, (await params).id);
  if ("response" in key) return key.response;
  try {
    const shoot = await getShoot(key.data);
    if (!shoot) return NextResponse.json({ error: "That shoot isn't here anymore." }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ shoot }, { headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "folder");
  }
}

/** Owner only: the folder's notes (what they asked for, still to confirm, bring extra) and names. */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const key = await parsed(shootKeySchema, (await params).id);
  if ("response" in key) return key.response;
  const patch = await parsed(shootPatchSchema, await bodyOf(req));
  if ("response" in patch) return patch.response;
  try {
    return NextResponse.json({ shoot: await updateShoot(key.data, patch.data) }, { headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "folder save");
  }
}

/** Owner only: delete a shoot without a booking (its photos first). Booking shoots go with their lead. */
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const key = await parsed(shootKeySchema, (await params).id);
  if ("response" in key) return key.response;
  try {
    await deleteStyledShoot(key.data, removeShootFiles);
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "styled delete");
  }
}
