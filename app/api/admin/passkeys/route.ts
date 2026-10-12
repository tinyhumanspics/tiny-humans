import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { listPasskeys, passkeysReady, removePasskey } from "@/lib/admin/passkeys";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };

/** Owner only: the devices that can sign in with Face ID / Touch ID (ready = migration 0020 applied). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const ready = await passkeysReady();
    return NextResponse.json({ ready, passkeys: ready ? await listPasskeys() : [] }, { headers: NO_STORE });
  } catch (err) {
    log.error("admin.passkey", "List failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't load the devices. Please try again." }, { status: 500 });
  }
}

/** Owner only: DELETE ?id= removes one device's passkey. */
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{8,1024}$/.test(id)) return NextResponse.json({ error: "Choose a device." }, { status: 400 });
  try {
    await removePasskey(id);
    return NextResponse.json({ ready: true, passkeys: await listPasskeys() }, { headers: NO_STORE });
  } catch (err) {
    log.error("admin.passkey", "Remove failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't remove that device. Please try again." }, { status: 500 });
  }
}
