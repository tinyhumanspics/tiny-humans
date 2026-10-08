import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./config";

/**
 * Public URL policy for Phase 3. This is deliberately not connected to the proxy until every Spanish page and email
 * is ready: English keeps its current URLs, Spanish uses `/es`, and families choose the language explicitly.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: false,
});
