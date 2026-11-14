import type { Instrumentation } from "next";

/**
 * Failure log (brief 01): an error no route handler caught (Next.js answers 500) is saved for the daily health check.
 * Only the route's path and the error's digest are kept, never the request or the error message.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, _request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (context.routeType !== "route" || !context.routePath.startsWith("/api/")) return;
  const digest = err && typeof err === "object" && "digest" in err ? String((err as { digest: unknown }).digest) : null;
  const { reportFailure } = await import("@/lib/monitoring/report");
  await reportFailure("api", `Unhandled error in ${context.routePath}`, { ref: digest });
};
