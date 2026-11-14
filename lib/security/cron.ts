import { timingSafeEqual } from "crypto";

/** True when the request comes from Vercel Cron (`Authorization: Bearer $CRON_SECRET`, at least 16 characters). */
export function isCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
