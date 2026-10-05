import "server-only";

/**
 * Small structured server logger. Never pass secrets, tokens, passwords or
 * full request bodies here; `safe()` strips obviously sensitive keys anyway.
 */
type Fields = Record<string, unknown>;

const SENSITIVE = /secret|token|password|authorization|cookie|client_secret|access_token|database_url/i;

function safe(fields: Fields = {}): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SENSITIVE.test(k)) continue;
    if (v instanceof Error) out[k] = { name: v.name, message: v.message.slice(0, 300) };
    else if (typeof v === "string") out[k] = v.slice(0, 300);
    else out[k] = v;
  }
  return out;
}

function write(level: "info" | "warn" | "error", scope: string, message: string, fields?: Fields) {
  const line = JSON.stringify({ level, scope, message, ...safe(fields), at: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (scope: string, message: string, fields?: Fields) => write("info", scope, message, fields),
  warn: (scope: string, message: string, fields?: Fields) => write("warn", scope, message, fields),
  error: (scope: string, message: string, fields?: Fields) => write("error", scope, message, fields),
};
