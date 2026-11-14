import "server-only";
import type { Area, Severity } from "./events";

/**
 * Reports a failure to the failure log (lib/monitoring/server.ts). Loaded lazily so low-level modules (emails, Graph,
 * Meta) don't pull the email templates in at load time, and never throws.
 */
export async function reportFailure(area: Area, message: string, opts: { severity?: Severity; ref?: string | null } = {}): Promise<void> {
  try {
    const { recordFailure } = await import("./server");
    await recordFailure(area, message, opts);
  } catch {
    // recordFailure already logs; a broken report must never break the caller
  }
}

/** An error's name and code, never its message (vendor and database messages can repeat customer data). */
export function errorCode(err: unknown): string {
  if (!err || typeof err !== "object") return "unknown error";
  const e = err as { name?: unknown; code?: unknown; status?: unknown };
  return [typeof e.name === "string" ? e.name : "Error", e.code ?? e.status].filter((x) => x !== undefined && x !== "").join(" ");
}
