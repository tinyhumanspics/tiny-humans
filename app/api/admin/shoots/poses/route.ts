import { NextResponse } from "next/server";
import { bodyOf, NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { createSignaturePose, listSignaturePoses, orderSignaturePoses } from "@/lib/shoots/server";
import { poseOrderSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

/** Owner only: the signature poses (every pose with its photos, in order). */
export async function GET(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  try {
    return NextResponse.json({ poses: await listSignaturePoses() }, { headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "poses list");
  }
}

/** Owner only: "+ Add a pose" (an empty card at the end). */
export async function POST(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  try {
    return NextResponse.json({ pose: await createSignaturePose() }, { status: 201, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "pose add");
  }
}

/** Owner only: "Move up" / "Move down" ({ order: every pose id, in the new order }). */
export async function PUT(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const input = await parsed(poseOrderSchema, await bodyOf(req));
  if ("response" in input) return input.response;
  try {
    await orderSignaturePoses(input.data.order);
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "poses order");
  }
}
