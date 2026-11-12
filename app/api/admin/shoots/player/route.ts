import { NextResponse } from "next/server";
import { expandVideoLink } from "@/lib/shoots/expand-link";
import { NO_STORE, parsed, shootsGuard } from "@/lib/shoots/route";
import { videoLinkSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

/**
 * Owner only: the player for a short share link (?link=vm.tiktok.com/…), so the video plays inside the day sheet.
 * `{ player: null }` = it can't play here (the sheet offers "Open in TikTok"). Only the pasted link is sent out.
 */
export async function GET(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const link = await parsed(videoLinkSchema, new URL(req.url).searchParams.get("link"));
  if ("response" in link) return link.response;
  return NextResponse.json({ player: await expandVideoLink(link.data) }, { headers: NO_STORE });
}
