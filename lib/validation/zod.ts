import { z } from "zod";

/**
 * Zod for code that also runs in the browser. Zod 4 probes `new Function` to compile faster parsers; the site's
 * Content-Security-Policy doesn't allow eval in browsers, so the browser copy runs without it (same results).
 * Servers keep the faster path.
 */
if (typeof window !== "undefined") z.config({ jitless: true });

export { z };
