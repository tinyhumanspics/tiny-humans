import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";
import { TOO_LARGE, readJson } from "@/lib/security/body";
import { cspViolations } from "@/lib/security/csp";

export const dynamic = "force-dynamic";

const NOTHING = () => new Response(null, { status: 204 });

/**
 * POST: Content-Security-Policy reports from browsers (legacy report-uri or Reporting API). Each violation is logged
 * in short form (directive, blocked origin/path, page path without query) so the policy can be tuned before it's
 * enforced. Always answers 204: browsers don't retry, and nothing here is worth an error.
 */
export async function POST(req: Request) {
  if (!(await allow("cspReport", clientIp(req)))) return NOTHING();
  const body = await readJson(req, 16 * 1024);
  if (body === TOO_LARGE || !body) return NOTHING();
  for (const violation of cspViolations(body)) log.warn("csp", "Policy violation", { ...violation });
  return NOTHING();
}
