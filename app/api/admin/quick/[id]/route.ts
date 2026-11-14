import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { log } from "@/lib/log";
import { deleteQuickRequest, QuickNotReadyError, setQuickStatus } from "@/lib/quick/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const patch = z.object({ status: z.enum(["new", "booked", "done"]), bookingReference: z.string().trim().max(40).nullable().optional() }).strict();

const fail = (err: unknown, scope: string) => {
  if (err instanceof QuickNotReadyError) return NextResponse.json({ error: err.message }, { status: 503 });
  log.error("admin.quick", `${scope} failed`, { error: err as Error });
  return NextResponse.json({ error: "Couldn't save that. Please try again." }, { status: 500 });
};

/** Owner only: mark a quick request booked (with the booking's reference), done, or new again. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const id = uuid.safeParse((await params).id);
  const body = patch.safeParse(await req.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "Check the request." }, { status: 400 });
  try {
    await setQuickStatus(id.data, body.data.status, body.data.bookingReference);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return fail(err, "Quick request update");
  }
}

/** Owner only: delete a quick request (a test, or spam). */
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const id = uuid.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Check the request." }, { status: 400 });
  try {
    await deleteQuickRequest(id.data);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return fail(err, "Quick request delete");
  }
}
