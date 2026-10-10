import { allMediaPhotos } from "@/lib/settings/defaults";
import type { SiteSettings } from "@/lib/settings/types";

/** Owner-controlled copy that must be complete before any Spanish public route can appear. */
export function spanishOwnerCopyIssues(settings: SiteSettings): string[] {
  const issues = new Set<string>();

  for (const photo of allMediaPhotos(settings)) {
    if (!photo.spanish?.title.trim() || !photo.spanish.alt.trim()) issues.add("photo details");
    if (photo.caption?.trim() && !photo.spanish?.caption?.trim()) issues.add("photo captions");
  }

  for (const media of Object.values(settings.media)) {
    for (const group of media?.groups ?? []) {
      const customized = Boolean(group.title?.trim() || group.text?.trim());
      if (customized && (!group.spanish?.title.trim() || !group.spanish.text.trim())) issues.add("gallery prompts");
    }
  }

  for (const offer of Object.values(settings.seasonalOffers)) {
    if (offer.enabled && (!offer.spanish?.title.trim() || !offer.spanish.description.trim())) issues.add("enabled seasonal offers");
  }

  return [...issues];
}
