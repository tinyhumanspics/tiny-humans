/**
 * The anonymous step counter on /book (brief 02; kept by brief 04): +1 per step, once per bundle per browser session,
 * with no names, emails, IPs or ids. Step ids: the request flow's (`request_sent` is counted on the server). Earlier
 * rows in funnel_counts may carry the old form's step ids.
 */
export const FUNNEL_STEPS = ["when_viewed", "when_done", "details_viewed", "request_sent"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];
