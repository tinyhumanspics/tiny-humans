import "server-only";
import { NextResponse } from "next/server";
import { site } from "@/config/site";
import type { AppLocale } from "@/i18n/config";
import { localePath } from "@/i18n/path";
import { isDatabaseConfigured } from "@/lib/db/client";
import { allow, clientIp } from "@/lib/rate-limit";
import { duePayment } from "@/lib/due-date/server";
import { bookingForPayLink, openPayment } from "./server";

const status = (state: string, locale: AppLocale) => NextResponse.redirect(
  `${site.url.replace(/\/$/, "")}${localePath("/pay/status", locale)}?s=${state}`,
  { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } },
);

/** Shared handler for the permanent English and Spanish payment entry routes. */
export async function paymentRoute(req: Request, fallbackLocale: AppLocale) {
  if (!(await allow("pay", clientIp(req)))) return status("error", fallbackLocale);
  if (!isDatabaseConfigured()) return status("error", fallbackLocale);
  const q = new URL(req.url).searchParams;
  // a due-date reservation's deposit (/pay?d=<reference>&k=<signature>)
  if (q.get("d")) {
    const due = await duePayment(q.get("d"), q.get("k")).catch(() => ({ status: "error" as const, locale: undefined }));
    if ("redirect" in due) return NextResponse.redirect(due.redirect, { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
    return status(due.status, due.locale ?? fallbackLocale);
  }
  const row = await bookingForPayLink({ reference: q.get("b"), signature: q.get("s"), token: q.get("t") }).catch(() => null);
  const locale = row?.locale ?? fallbackLocale;
  const outcome = await openPayment(row);
  if ("redirect" in outcome) return NextResponse.redirect(outcome.redirect, { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  return status(outcome.status, locale);
}
