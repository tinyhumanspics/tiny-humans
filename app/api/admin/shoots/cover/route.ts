import { NextResponse } from "next/server";
import { coverFor } from "@/lib/shoots/cover";
import { parsed, shootsGuard } from "@/lib/shoots/route";
import { videoLinkSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

/**
 * Owner only: the cover picture of a pasted Instagram/YouTube video (?link=…) for its card on the day sheet and in
 * the folder. 404 = no picture (the card keeps its ▶). Kept a day in the owner's browser; nothing is stored here.
 */
export async function GET(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const link = await parsed(videoLinkSchema, new URL(req.url).searchParams.get("link"));
  if ("response" in link) return link.response;
  const cover = await coverFor(link.data);
  if (!cover) return new NextResponse(null, { status: 404, headers: { "cache-control": "private, max-age=3600" } });
  return new NextResponse(cover.bytes, {
    headers: {
      "content-type": cover.type,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
