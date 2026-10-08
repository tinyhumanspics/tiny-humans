import "server-only";
import { cookies } from "next/headers";
import { FBC_COOKIE } from "@/lib/tracking/attribution";
import { clientIp } from "@/lib/rate-limit";
import { verifyDepositLink } from "@/lib/payments/link";
import type { ClientContext } from "./flow";

/** The booking reference behind a signed deposit link (?b= / ?k=, or the same in a JSON body), or null. */
export function depositLinkReference(b: unknown, k: unknown): string | null {
  return typeof b === "string" && typeof k === "string" && verifyDepositLink(b, k) ? b : null;
}

/** The family's browser, for Meta's Conversions API when their return confirms the booking. */
export async function clientContext(req: Request): Promise<ClientContext> {
  const jar = await cookies();
  const ip = clientIp(req);
  return {
    ip: ip === "unknown" ? undefined : ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
    fbp: jar.get("_fbp")?.value,
    fbc: jar.get("_fbc")?.value ?? jar.get(FBC_COOKIE)?.value,
  };
}
