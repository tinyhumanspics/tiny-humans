import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, clientIp } from "@/lib/rate-limit";
import { checkPassword, createSessionToken, isAuthConfigured, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

const inputSchema = z.object({ password: z.string().min(1).max(1024) }).strict();
const NO_STORE = { "cache-control": "no-store" };

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "The owner password isn't set up yet. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel." }, { status: 503 });
  }
  if (!(await allow("adminLogin", clientIp(req))) || !(await allow("adminLoginGlobal", "all"))) {
    return NextResponse.json({ error: "Too many sign-in attempts. Please wait 15 minutes and try again." }, { status: 429 });
  }
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 2048) {
    return NextResponse.json({ error: "That sign-in request is too large." }, { status: 413, headers: NO_STORE });
  }
  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  const password = parsed.success ? parsed.data.password : "";
  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return NextResponse.json({ error: "That password isn't right." }, { status: 401, headers: NO_STORE });
  }
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    priority: "high",
  });
  return res;
}
