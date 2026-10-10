"use client";

import { useRef, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation, site } from "@/config/site";
import type en from "@/messages/en.json";
import type { AppLocale } from "@/i18n/config";
import { localePath } from "@/i18n/path";
import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import TinyHumansLogo from "@/components/TinyHumansLogo/TinyHumansLogo";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import LanguageSwitcher from "@/components/LanguageSwitcher/LanguageSwitcher";
import { useIntroAnimation } from "./useIntroAnimation";
import styles from "./Header.module.css";
import { cn } from "@/lib/cn";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

export default function Header({ messages, languageMessages, locale, showLanguageSwitcher = false }: { messages: typeof en.header; languageMessages: typeof en.language; locale: AppLocale; showLanguageSwitcher?: boolean }) {
  const logoRef = useRef<HTMLDivElement>(null);
  const { theme, ready } = useSiteSettings();
  const logo = theme.logo;
  const drawState = useIntroAnimation(logoRef, ready, Object.values(logo.layers) as string[]);
  // static builds report "/bundles/" (trailing slash); normalize it
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  const homeHref = localePath("/", locale);

  // On the home page the logo scrolls to the top; elsewhere it links home.
  const onLogoClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== homeHref) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    history.replaceState(null, "", window.location.pathname + window.location.search);
  };

  return (
    <>
      <div className={styles.introOverlay} aria-hidden="true" />
      <header className={styles.header}>
        <div className={cn("container", styles.bar)}>
          <Link href={homeHref} className={styles.logoLink} onClick={onLogoClick} aria-label={fill(messages.logoHome, { brand: site.name })}>
            <span className={styles.logoSlot} style={{ "--logo-aspect": logo.drawing.height / logo.drawing.width } as React.CSSProperties}>
              <div ref={logoRef} className={styles.logoMover}>
                <TinyHumansLogo logo={logo} state={drawState} />
              </div>
            </span>
          </Link>
          <nav aria-label={messages.navigationLabel} className={styles.nav}>
            <ul>
              {navigation.map((item) => (
                <li key={item.message}>
                  <Link
                    href={localePath(item.href, locale)}
                    className={cn(styles.link, "emphasis" in item && item.emphasis ? styles.emphasis : "")}>
                    <span className="chalk-soft">{messages[item.message]}</span>
                    {"emphasis" in item && item.emphasis && (
                      <ChalkDoodle name="circle" className={styles.circle} color="var(--sun-yellow)" strokeWidth={2.6} size="100%" />
                    )}
                  </Link>
                </li>
              ))}
              {showLanguageSwitcher && !pathname.startsWith("/admin") && (
                <li className={styles.languageItem}>
                  <LanguageSwitcher locale={locale} messages={languageMessages} />
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}
