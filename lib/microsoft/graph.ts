import "server-only";
import { log } from "@/lib/log";
import { getGraphToken } from "./auth";

const GRAPH = "https://graph.microsoft.com/v1.0";

export class GraphError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "GraphError";
    this.status = status;
    this.code = code;
  }
}

/** Authenticated Microsoft Graph request (server only). Retries once on throttling. */
export async function graphFetch<T = unknown>(path: string, init: RequestInit & { scope?: string } = {}): Promise<T> {
  const { scope = "graph", ...req } = init;
  const url = path.startsWith("https://") ? path : `${GRAPH}${path}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getGraphToken();
    let res: Response;
    try {
      res = await fetch(url, {
        ...req,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(req.headers ?? {}) },
        cache: "no-store",
      });
    } catch (err) {
      log.error(scope, "Could not reach Microsoft Graph", { error: err as Error, path: path.split("?")[0] });
      throw new GraphError(0, "NetworkError", "Could not reach Microsoft Graph");
    }
    if (res.status === 429 && attempt === 0) {
      const wait = Math.min(5, Number(res.headers.get("retry-after") ?? 2)) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (res.status === 202 || res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string } }).error;
      log.error(scope, "Graph request failed", { status: res.status, code: err?.code, path: path.split("?")[0] });
      throw new GraphError(res.status, err?.code, err?.message ?? `Graph request failed (${res.status})`);
    }
    return data as T;
  }
  throw new GraphError(429, "TooManyRequests", "Graph throttled the request");
}
