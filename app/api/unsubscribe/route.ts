import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db/client";
import { NO_STORE, invalidLink, tokenOk, tooMany } from "@/lib/booking/manage-api";
import { allow, clientIp } from "@/lib/rate-limit";
import { BODY_LIMITS, TOO_LARGE, readJson } from "@/lib/security/body";
import { unsubscribeByToken } from "@/lib/unfinished/server";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * POST: no more marketing emails to this address. Two callers: the /unsubscribe page (JSON {token}) and mail apps'
 * one-click button (RFC 8058: POST to the List-Unsubscribe URL `?t=…` with "List-Unsubscribe=One-Click").
 */
export async function POST(req: Request) {
  if (!(await allow("unsubscribe", clientIp(req)))) return tooMany();
  let token = new URL(req.url).searchParams.get("t");
  if (!token && (req.headers.get("content-type") ?? "").includes("application/json")) {
    const raw = await readJson(req, BODY_LIMITS.small);
    if (raw !== TOO_LARGE && raw && typeof raw === "object") token = String((raw as { token?: unknown }).token ?? "");
  }
  if (!tokenOk(token) || !isDatabaseConfigured()) return invalidLink();
  try {
    return (await unsubscribeByToken(token)) ? NextResponse.json({ ok: true }, { headers: NO_STORE }) : invalidLink();
  } catch (err) {
    log.error("api.unsubscribe", "Could not unsubscribe", { error: err as Error });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500, headers: NO_STORE });
  }
}
