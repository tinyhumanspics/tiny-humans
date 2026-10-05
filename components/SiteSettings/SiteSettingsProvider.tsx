"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { getTheme, themeCssVariables, type ThemeDefinition, type TinyHumansTheme } from "@/config/themes";
import { portfolio as builtInPhotos, type PortfolioPhoto } from "@/config/portfolio";
import type { SiteSettings } from "@/lib/settings/types";
import { IS_PROTOTYPE, readPrototypeSettings } from "@/lib/admin/client";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Ctx {
  settings: SiteSettings;
  themeId: TinyHumansTheme;
  theme: ThemeDefinition;
  /** Photos shown on the site (owner's photos, or the built-in ones). */
  photos: PortfolioPhoto[];
  /** Apply settings immediately (used by /admin after saving). */
  applySettings: (s: SiteSettings) => void;
  /** True once the active theme is known in the browser (the intro waits for it). */
  ready: boolean;
}

const SiteSettingsContext = createContext<Ctx | null>(null);

export function SiteSettingsProvider({ initial, children }: { initial: SiteSettings; children: ReactNode }) {
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
      photos: livePhotos(settings),
      applySettings,
      ready,
    }),
    [settings, theme, applySettings, ready],
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings(): Ctx {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error("useSiteSettings must be used inside SiteSettingsProvider");
  return ctx;
}

/** Photos on the site: the live picture set, falling back to the Original set. */
export function livePhotos(s: SiteSettings): PortfolioPhoto[] {
  const live = s.photoSets[s.photoSetId];
  if (live?.length) return live;
  return s.photoSets.default?.length ? s.photoSets.default : builtInPhotos;
}

export function findPhoto(photos: PortfolioPhoto[], id: string | null | undefined): PortfolioPhoto | undefined {
  return id ? photos.find((p) => p.id === id) : undefined;
}
