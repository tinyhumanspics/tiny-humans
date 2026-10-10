import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { log } from "@/lib/log";
import { SettingsInputError, parseSettings } from "@/lib/settings/defaults";
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
  const input = await req.json().catch(() => undefined);
  if (input === undefined) return NextResponse.json({ error: "Couldn't read the settings. Please try again." }, { status: 400 });
  try {
    const previous = await readSettingsFresh();
    const parsed = parseSettings(input);
    // The dedicated Spanish endpoint validates readiness before changing this safety-critical switch.
    const next = { ...parsed, spanishPublished: previous.spanishPublished };
    return NextResponse.json(await saveSiteSettings(next, previous));
  } catch (e) {
    if (e instanceof SettingsInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    log.error("admin.settings", "Save failed", { error: e as Error });
    return NextResponse.json({ error: "Couldn't save the settings. Please try again." }, { status: 500 });
  }
}
