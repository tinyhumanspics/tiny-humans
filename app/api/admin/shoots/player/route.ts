import { NextResponse } from "next/server";
import { z } from "zod";
import { expandVideoLink } from "@/lib/shoots/expand-link";
import { MAX_LINK_LENGTH } from "@/lib/shoots/links";
import { NO_STORE, parsed, shootsGuard } from "@/lib/shoots/route";

export const dynamic = "force-dynamic";

const linkSchema = z.string().trim().min(1, "Which link?").max(MAX_LINK_LENGTH, "That link is too long.");

/**
 * Owner only: the player for a short share link (?link=vm.tiktok.com/…), so the video plays inside the day sheet.
 * `{ player: null }` = it can't play here (the sheet offers "Open in TikTok"). Only the pasted link is sent out.
 */
export async function GET(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const link = await parsed(linkSchema, new URL(req.url).searchParams.get("link"));
  if ("response" in link) return link.response;
  return NextResponse.json({ player: await expandVideoLink(link.data) }, { headers: NO_STORE });
}
