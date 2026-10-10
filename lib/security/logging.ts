/** Values that must never be copied into application logs. */
const SENSITIVE_KEY =
  /secret|token|password|authorization|cookie|client.?secret|access.?token|database.?url|email|phone|address|street|parent|baby|customer|family|recipient|display.?name|first.?name|last.?name|full.?name|given.?name|surname|notes?|fbclid|user.?agent|client.?ip|remote.?addr|\bip\b/i;

const MAX_STRING = 300;
const MAX_ARRAY = 25;
const MAX_KEYS = 40;
const MAX_DEPTH = 4;

function codeOf(value: unknown): string | number | undefined {
  if (typeof value === "string") return value.slice(0, 80);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

/**
 * Error messages are deliberately excluded. Drizzle errors can repeat every
 * inserted value (including family contact details) in `message`; stable error
 * codes are enough to find the failing subsystem without copying those values.
 */
function safeError(error: Error & { code?: unknown; cause?: unknown }): Record<string, unknown> {
  const out: Record<string, unknown> = { name: error.name || "Error" };
  const code = codeOf(error.code);
  if (code !== undefined) out.code = code;
  if (error.cause && typeof error.cause === "object") {
    const cause = error.cause as { name?: unknown; code?: unknown; constraint?: unknown; table?: unknown; column?: unknown };
    if (typeof cause.name === "string") out.causeName = cause.name.slice(0, 80);
    const causeCode = codeOf(cause.code);
    if (causeCode !== undefined) out.causeCode = causeCode;
    for (const key of ["constraint", "table", "column"] as const) {
      if (typeof cause[key] === "string") out[key] = cause[key].slice(0, 120);
    }
  }
  return out;
}

function sanitize(value: unknown, depth: number): unknown {
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, MAX_STRING);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return safeError(value);
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_KEYS)) {
      if (!SENSITIVE_KEY.test(key)) out[key] = sanitize(item, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, MAX_STRING);
}

export function sanitizeLogFields(fields: Record<string, unknown> = {}): Record<string, unknown> {
  return sanitize(fields, 0) as Record<string, unknown>;
}
