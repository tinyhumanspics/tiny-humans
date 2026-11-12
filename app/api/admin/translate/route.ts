import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { toSpanish, TranslationError, translationEnabled } from "@/lib/i18n/autotranslate";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
// a translation can take up to ~45 s (one retry included)
export const maxDuration = 60;

/**
 * Owner only: "Fill in Spanish for me" in Photos / Media and Seasonal Landing (owner, Nov 11: "I have to be
 * translating myself"). The same translator as the save-time fill-in (lib/i18n/autotranslate.ts): only the owner's
 * own website words are sent, never family data. Without ANTHROPIC_API_KEY it answers `on: false` and the English.
 */
const body = z.object({ texts: z.array(z.string().max(600)).min(1).max(12) });

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ on: translationEnabled() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nothing to translate." }, { status: 400 });
  try {
    // strict: when it can't translate, the button says why (owner, Nov 11) instead of filling in the English
    return NextResponse.json({ on: translationEnabled(), spanish: await toSpanish(parsed.data.texts, { strict: true }) }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof TranslationError) return NextResponse.json({ error: err.message }, { status: 502, headers: { "cache-control": "no-store" } });
    log.error("admin.translate", "Translation failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't translate just now. Leave the Spanish empty and it's filled in when you save." }, { status: 500 });
  }
}
