import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { getSpanishPublicationStatus, getSpanishReadiness } from "@/i18n/publication";
import { isStorageConfigured, readSettingsFresh, saveSiteSettings } from "@/lib/settings/server";

export const dynamic = "force-dynamic";

const inputSchema = z.object({ enabled: z.boolean() });

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const settings = await readSettingsFresh();
  return NextResponse.json(await getSpanishPublicationStatus(settings));
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Storage isn't connected yet. Connect a Vercel Blob store to this project." }, { status: 503 });
  }

  try {
    const { enabled } = inputSchema.parse(await req.json());
    const previous = await readSettingsFresh();
    if (enabled) {
      const readiness = await getSpanishReadiness(previous);
      if (!readiness.catalog || readiness.issues.length) {
        const missing = readiness.issues.length ? readiness.issues.join("; ") : "Spanish bundle translations";
        return NextResponse.json({ error: `Spanish can't be published yet. Complete: ${missing}.` }, { status: 400 });
      }
    }

    const settings = await saveSiteSettings({ ...previous, spanishPublished: enabled }, previous);
    return NextResponse.json({ settings, status: await getSpanishPublicationStatus(settings) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't change Spanish publication." }, { status: 400 });
  }
}
