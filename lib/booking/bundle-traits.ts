import type { Bundle } from "@/config/bundles";

/** Siblings can join this bundle: its "people" line or one of its features says so (both edited in /admin). */
export const includesSiblings = (b: Pick<Bundle, "people" | "features">) => /sibling|herman/i.test([b.people, ...b.features].join(" "));
