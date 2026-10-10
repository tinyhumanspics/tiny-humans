import "server-only";
import { sanitizeLogFields } from "@/lib/security/logging";

/**
 * Small structured server logger. Never pass secrets, tokens, passwords or
 * full request bodies here; `safe()` strips obviously sensitive keys anyway.
 */
type Fields = Record<string, unknown>;

function write(level: "info" | "warn" | "error", scope: string, message: string, fields?: Fields) {
  const line = JSON.stringify({ level, scope, message, ...sanitizeLogFields(fields), at: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (scope: string, message: string, fields?: Fields) => write("info", scope, message, fields),
  warn: (scope: string, message: string, fields?: Fields) => write("warn", scope, message, fields),
  error: (scope: string, message: string, fields?: Fields) => write("error", scope, message, fields),
};
