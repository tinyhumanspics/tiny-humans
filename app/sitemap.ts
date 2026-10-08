import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/seo/metadata";

const INDEXABLE_PATHS = ["/", "/about", "/bundles", "/home-sweet-home", "/privacy", "/terms"] as const;

/** Only canonical public pages belong here; booking/manage/admin/API URLs are intentionally excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PATHS.map((path) => ({ url: new URL(path, `${PUBLIC_SITE_URL}/`).toString() }));
}
