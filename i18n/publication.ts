import "server-only";
import { cache } from "react";
import { getSiteSettings } from "@/lib/settings/server";
import { getPublicCatalog, type PublicCatalog } from "@/lib/pricing/server";
import type { SiteSettings, SpanishPublicationStatus } from "@/lib/settings/types";
import { spanishOwnerCopyIssues } from "./publication-audit";

export { spanishOwnerCopyIssues } from "./publication-audit";

export interface SpanishPublication {
  published: boolean;
  issues: string[];
  catalog: PublicCatalog | null;
}

/** Check every live content source. Used by the public gate and the protected owner toggle. */
export async function getSpanishReadiness(settings: SiteSettings): Promise<Omit<SpanishPublication, "published">> {
  const issues = spanishOwnerCopyIssues(settings);
  let catalog: PublicCatalog | null = null;
  try {
    catalog = await getPublicCatalog("es");
  } catch {
    issues.push("Spanish bundle translations");
  }

  return { issues, catalog };
}

export async function getSpanishPublicationStatus(settings: SiteSettings): Promise<SpanishPublicationStatus> {
  const readiness = await getSpanishReadiness(settings);
  return {
    enabled: settings.spanishPublished,
    published: settings.spanishPublished && Boolean(readiness.catalog) && readiness.issues.length === 0,
    issues: readiness.issues,
  };
}

/** The /admin switch is the native-review sign-off; readiness gates still fail closed on every content revision. */
export const getSpanishPublication = cache(async (): Promise<SpanishPublication> => {
  const settings = await getSiteSettings();
  if (!settings.spanishPublished) {
    return { published: false, issues: ["publication switch"], catalog: null };
  }
  const readiness = await getSpanishReadiness(settings);
  return {
    published: Boolean(readiness.catalog) && readiness.issues.length === 0,
    ...readiness,
  };
});
