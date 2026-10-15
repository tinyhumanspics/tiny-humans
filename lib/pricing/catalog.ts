import { devBundles } from "./dev-bundles";
import type { Bundle } from "./types";

/** True on the Vercel production deployment, i.e. the live site (previews and local servers are not). */
export const isLiveSite = () => process.env.VERCEL_ENV === "production";

/**
 * The built-in bundles, for local development, the database-less CI tests and previews. The live site never uses
 * them, even if its database setting goes missing: no hardcoded price is ever shown or charged (owner, Oct 15).
 */
export function builtInCatalog(): Bundle[] {
  if (isLiveSite()) throw new Error("Built-in bundles are never used on the live site");
  return devBundles.map((b, i) => ({ ...b, active: true, sortOrder: i, offer: null }));
}

export const sortBundles = (list: Bundle[]) => [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
