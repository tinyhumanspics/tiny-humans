import "server-only";
import { NextResponse } from "next/server";
import { BookingError } from "./errors";
import { log } from "@/lib/log";

export const NO_STORE = { "cache-control": "no-store", "referrer-policy": "no-referrer" };
export const tokenOk = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);
export const invalidLink = () => NextResponse.json({ error: "This link isn't valid anymore. Please use the link in your most recent Tiny Humans email, or reply to it and we'll help.", code: "not_found" }, { status: 404, headers: NO_STORE });
export const tooMany = () => NextResponse.json({ error: "Too many attempts. Please wait a few minutes and try again.", code: "rate_limited" }, { status: 429, headers: NO_STORE });
export function manageFail(err: unknown, scope: string) {
  if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status, headers: NO_STORE });
  log.error(scope, "Unexpected error", { error: err as Error });
  return NextResponse.json({ error: "Something went wrong. Please try again.", code: "server_error" }, { status: 500, headers: NO_STORE });
}
