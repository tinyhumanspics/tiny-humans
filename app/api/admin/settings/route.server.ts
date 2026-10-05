import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { parseSettings } from "@/lib/settings/defaults";
import { isStorageConfigured, readSettingsFresh, saveSiteSettings } from "@/lib/settings/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json(await readSettingsFresh());
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Storage isn't connected yet. Connect a Vercel Blob store to this project." }, { status: 503 });
  }
  try {
    const next = parseSettings(await req.json());
    const previous = await readSettingsFresh();
    return NextResponse.json(await saveSiteSettings(next, previous));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save the settings." }, { status: 400 });
  }
}
