const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function originOf(value: string | null): string | null {
  if (!value || value === "null") return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Browser mutations in the owner area must come from this exact origin.
 * SameSite cookies remain defense in depth; this also rejects sibling-domain
 * and legacy-browser CSRF requests.
 */
export function hasTrustedMutationOrigin(request: Pick<Request, "method" | "url" | "headers">): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const target = originOf(request.url);
  const originHeader = request.headers.get("origin");
  // A present-but-invalid Origin (including `null`) must fail closed. Referer is
  // only a fallback for older clients that omitted Origin entirely.
  const source = originHeader === null ? originOf(request.headers.get("referer")) : originOf(originHeader);
  return Boolean(target && source && target === source);
}
