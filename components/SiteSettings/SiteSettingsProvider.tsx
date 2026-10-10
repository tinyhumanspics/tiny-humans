"use client";

import { fallbackMediaFor, feedPhotos, resolveMedia, type ResolvedMedia } from "@/config/media";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { getTheme, themeCssVariables, type ThemeDefinition, type TinyHumansTheme } from "@/config/themes";
import type { PortfolioPhoto } from "@/config/portfolio";
import type { SiteSettings } from "@/lib/settings/types";
import type { AppLocale } from "@/i18n/config";
import { IS_PROTOTYPE, readPrototypeSettings } from "@/lib/admin/client";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Ctx {
  settings: SiteSettings;
  themeId: TinyHumansTheme;
  theme: ThemeDefinition;
  /** Pictures for the active theme, by website section. */
  media: ResolvedMedia;
  /** "Little moments" photos in feed order (lightbox, inspiration links). */
  photos: PortfolioPhoto[];
  /** Apply settings immediately (used by /admin after saving). */
  applySettings: (s: SiteSettings) => void;
  /** True once the active theme is known in the browser (the intro waits for it). */
  ready: boolean;
}

const SiteSettingsContext = createContext<Ctx | null>(null);

export function SiteSettingsProvider({ initial, locale = "en", children }: { initial: SiteSettings; locale?: AppLocale; children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(initial);
  const [ready, setReady] = useState(false);

  // Prototype only: the owner's choices are kept in this browser.
  useIsoLayoutEffect(() => {
    if (IS_PROTOTYPE) {
      const saved = readPrototypeSettings();
      if (saved) setSettings(saved);
    }
    setReady(true);
  }, []);

  const theme = getTheme(settings.themeId);

  // Keep the CSS variables on <html> in sync with the active theme.
  useIsoLayoutEffect(() => {
    const root = document.documentElement;
    Object.entries(themeCssVariables(theme)).forEach(([k, v]) => root.style.setProperty(k, v));
    root.dataset.theme = theme.id;
  }, [theme]);

  const applySettings = useCallback((s: SiteSettings) => setSettings(s), []);

  const value = useMemo<Ctx>(
    () => ({
      settings,
      themeId: theme.id,
      theme,
      media: liveMedia(settings, locale),
      photos: feedPhotos(liveMedia(settings, locale)),
      applySettings,
      ready,
    }),
    [settings, theme, locale, applySettings, ready],
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings(): Ctx {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error("useSiteSettings must be used inside SiteSettingsProvider");
  return ctx;
}

/** Pictures for the theme visitors see (empty slots show the Default theme's picture). */
export function liveMedia(s: SiteSettings, locale: AppLocale = "en"): ResolvedMedia {
  return resolveMedia(s.media[s.themeId], fallbackMediaFor(s.themeId, s.media), locale);
}

export function findPhoto(photos: PortfolioPhoto[], id: string | null | undefined): PortfolioPhoto | undefined {
  return id ? photos.find((p) => p.id === id) : undefined;
}
