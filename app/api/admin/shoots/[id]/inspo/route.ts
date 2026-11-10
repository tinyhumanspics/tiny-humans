import { NextResponse } from "next/server";
import { bodyOf, NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { addInspo } from "@/lib/shoots/server";
import { newInspoSchema, shootKeySchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Owner only: a pasted link or a text-only shot/idea ({ type: "link", group, url } or { type: "note", group }). */
export async function POST(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const key = await parsed(shootKeySchema, (await params).id);
  if ("response" in key) return key.response;
  const input = await parsed(newInspoSchema, await bodyOf(req));
  if ("response" in input) return input.response;
  try {
    return NextResponse.json({ item: await addInspo(key.data, input.data) }, { status: 201, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "inspo add");
  }
}
