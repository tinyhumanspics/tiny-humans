import type { SignInput } from "./validation";
import type { SignedWaiver, WaiverContext } from "./types";

/** Browser calls for the photo and video release (owner only; the routes check the session). */

export class WaiverApiError extends Error {
  constructor(message: string, readonly status: number, readonly notReady = false) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init, headers: init?.body ? { "content-type": "application/json" } : undefined });
  } catch {
    throw new WaiverApiError("No connection. Check the internet and try again.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; notReady?: boolean };
  if (!res.ok) throw new WaiverApiError(data.error || "Something went wrong. Try again.", res.status, Boolean(data.notReady));
  return data as T;
}

export const waiverApi = {
  session: async () => (await call<{ authenticated: boolean }>("/api/admin/session")).authenticated,
  context: async (reference: string) => (await call<{ context: WaiverContext }>(`/api/admin/waiver?${new URLSearchParams({ ref: reference })}`)).context,
  sign: async (input: SignInput) => (await call<{ saved: { id: string; signedAt: string } }>("/api/admin/waiver", { method: "POST", body: JSON.stringify(input) })).saved,
  signed: async (id: string) => (await call<{ waiver: SignedWaiver }>(`/api/admin/waiver/${id}`)).waiver,
};
