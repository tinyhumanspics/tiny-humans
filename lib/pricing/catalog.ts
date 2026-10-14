import { devBundles } from "./dev-bundles";
import type { Bundle } from "./types";

/** The original three bundles (used before the database/migration exists: local development and tests). */
export function builtInCatalog(): Bundle[] {
  return devBundles.map((b, i) => ({ ...b, active: true, sortOrder: i, offer: null }));
}

export const sortBundles = (list: Bundle[]) => [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
