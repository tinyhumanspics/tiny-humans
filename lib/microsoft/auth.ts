import "server-only";
import { log } from "@/lib/log";
import { microsoftConfig } from "./config";

/**
 * Microsoft identity platform, client-credentials flow (app-only access).
 * The token stays on the server, cached in memory until shortly before it expires.
 */
let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;

export class GraphAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphAuthError";
  }
}

export async function getGraphToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;
  if (inflight) return inflight;
  inflight = (async () => {
    const { tenantId, clientId, clientSecret } = microsoftConfig();
    if (!tenantId || !clientId || !clientSecret) throw new GraphAuthError("Microsoft credentials are not configured");
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });
    let res: Response;
    try {
      const login = (!process.env.VERCEL && process.env.MICROSOFT_LOGIN_BASE_URL) || "https://login.microsoftonline.com";
      res = await fetch(`${login}/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      });
    } catch (err) {
      log.error("graph.auth", "Could not reach Microsoft sign-in", { error: err as Error });
      throw new GraphAuthError("Could not reach Microsoft sign-in");
    }
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_codes?: number[] };
    if (!res.ok || !data.access_token) {
      // log the error code only (never the secret or the response body)
      log.error("graph.auth", "Token request failed", { status: res.status, error: data.error, errorCodes: data.error_codes });
      throw new GraphAuthError(`Token request failed (${res.status} ${data.error ?? "unknown"})`);
    }
    cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return data.access_token;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
