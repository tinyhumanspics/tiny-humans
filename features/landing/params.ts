import type { LandingConcept } from "./LandingPage";

type Search = Record<string, string | string[] | undefined>;

/**
 * The ad link's parameters on /home-sweet-home (brief 05): `c` picks the headline (message match, default "a"); every
 * other parameter (utm_*, th_ad/th_adset/th_campaign, fbclid) rides along on each "Check dates" link to /book.
 */
export function landingParams(search: Search): { concept: LandingConcept; query: string } {
  const c = typeof search.c === "string" ? search.c : "";
  const keep = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (key === "c" || key === "bundle" || typeof value !== "string" || !value) continue;
    keep.set(key, value.slice(0, 300));
  }
  return { concept: c === "b" || c === "c" ? c : "a", query: keep.toString() };
}
