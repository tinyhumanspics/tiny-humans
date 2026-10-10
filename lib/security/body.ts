/** Returned by `readJson` when a request body is over its limit. */
export const TOO_LARGE = Symbol("request body too large");

/**
 * Reads a JSON request body of at most `maxBytes`, counting bytes as they arrive, so a missing or wrong
 * Content-Length can't get around the limit. Returns `TOO_LARGE` past the limit, and null for a missing or
 * malformed body (routes then give their normal "please check the details" answer).
 */
export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return TOO_LARGE;
  if (!req.body) return null;

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        return TOO_LARGE;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** The answer to a body over its limit. */
export function tooLargeResponse(headers?: HeadersInit): Response {
  return Response.json({ error: "That request is too large.", code: "too_large" }, { status: 413, headers });
}

/** Body limits for the public routes: several times the longest input each form allows, even fully escaped. */
export const BODY_LIMITS = {
  booking: 64 * 1024,
  review: 32 * 1024,
  cancel: 16 * 1024,
  small: 8 * 1024,
} as const;
