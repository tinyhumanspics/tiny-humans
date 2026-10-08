import { NextResponse } from "next/server";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { depositOfferFor } from "@/lib/deposit/server";
import type { DepositOffer } from "@/lib/deposit/types";
import { allow, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/booking/deposit?bundle=<id>: that bundle's deposit (null = none) and the cancel notice, for the form's last step. */
export async function GET(req: Request) {
  if (!(await allow("quote", clientIp(req)))) return NextResponse.json({ error: "Too many requests. Please wait a few minutes.", code: "rate_limited" }, { status: 429 });
  const bundle = new URL(req.url).searchParams.get("bundle")?.trim() ?? "";
  if (!/^[a-z0-9-]{1,64}$/.test(bundle)) return NextResponse.json({ error: "Choose a bundle first.", code: "invalid_request" }, { status: 400 });
  const [amountCents, noticeHours] = await Promise.all([depositOfferFor(bundle), getNoticeHoursSetting()]);
  const offer: DepositOffer = { amountCents, noticeHours };
  return NextResponse.json(offer, { headers: { "cache-control": "no-store" } });
}
