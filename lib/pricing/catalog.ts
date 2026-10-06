import { bundles as builtInBundles, type Bundle } from "@/config/bundles";

/** The original three bundles (used before the database/migration exists, and in the prototype). */
export function builtInCatalog(): Bundle[] {
  return builtInBundles.map((b, i) => ({ ...b, active: true, sortOrder: i, offer: null }));
}

export const sortBundles = (list: Bundle[]) => [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
