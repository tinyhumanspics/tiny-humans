import "server-only";
import { cache } from "react";
import { getSiteSettings } from "@/lib/settings/server";
import { getPublicCatalog, type PublicCatalog } from "@/lib/pricing/server";
import { spanishOwnerCopyIssues } from "./publication-audit";

export { spanishOwnerCopyIssues } from "./publication-audit";

export interface SpanishPublication {
  published: boolean;
  issues: string[];
  catalog: PublicCatalog | null;
}

/**
 * The environment switch is the native-review sign-off. Even after it is set, the live bundle and owner-copy gates
 * are checked on every cached settings/catalog revision so deleting a translation safely unpublishes `/es`.
 */
export const getSpanishPublication = cache(async (): Promise<SpanishPublication> => {
  if (process.env.SPANISH_SITE_PUBLISHED !== "1") {
    return { published: false, issues: ["native review and publication switch"], catalog: null };
  }

  const settings = await getSiteSettings();
  const issues = spanishOwnerCopyIssues(settings);
  let catalog: PublicCatalog | null = null;
  try {
    catalog = await getPublicCatalog("es");
  } catch {
    issues.push("bundle translations");
  }

  return { published: Boolean(catalog) && issues.length === 0, issues, catalog };
});
