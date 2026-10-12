import { parseSettings } from "@/lib/settings/defaults";
import type { SiteSettings } from "@/lib/settings/types";

/**
 * The click-through prototype (static export): the owner's settings live in this browser instead of the server.
 * Kept apart from lib/admin/client so public pages can check it without loading the whole owner-area client.
 */
export const IS_PROTOTYPE = process.env.NEXT_PUBLIC_PROTOTYPE === "1";
export const PROTOTYPE_STORAGE_KEY = "tinyhumans:prototype-settings";

/** Prototype only: the settings saved in this browser (null when none or unreadable). */
export function readPrototypeSettings(): SiteSettings | null {
  try {
    const raw = window.localStorage.getItem(PROTOTYPE_STORAGE_KEY);
    return raw ? parseSettings(JSON.parse(raw), { allowDataUrls: true }) : null;
  } catch {
    return null;
  }
}
