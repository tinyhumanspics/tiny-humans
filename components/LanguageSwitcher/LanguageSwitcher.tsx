"use client";

import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import type { AppLocale } from "@/i18n/config";
import { switchLocalePath } from "@/i18n/path";
import type en from "@/messages/en.json";
import { cn } from "@/lib/cn";
import styles from "./LanguageSwitcher.module.css";

export default function LanguageSwitcher({
  locale,
  messages,
  placement = "header",
}: {
  locale: AppLocale;
  messages: typeof en.language;
  placement?: "header" | "footer";
}) {
  const pathname = usePathname();
  const target: AppLocale = locale === "en" ? "es" : "en";
  const href = switchLocalePath(pathname, target);
  const switchLabel = target === "es" ? messages.switchToSpanish : messages.switchToEnglish;

  // Locale changes intentionally make a full navigation so the root shell, catalog and <html lang> all change.
  const changeLanguage = (event: MouseEvent<HTMLAnchorElement>) => {
    event.currentTarget.href = `${window.location.origin}${href}${window.location.search}${window.location.hash}`;
  };

  const option = (value: AppLocale, label: string) => value === locale
    ? <span className={styles.current} aria-current="page">{label}</span>
    : <a className={styles.link} href={href} hrefLang={value} lang={value} aria-label={switchLabel} onClick={changeLanguage}>{label}</a>;

  return (
    <div className={cn(styles.switcher, placement === "footer" && styles.footer)} aria-label={messages.label} role="group">
      {option("en", messages.english)}
      <span className={styles.separator} aria-hidden="true">|</span>
      {option("es", messages.spanish)}
    </div>
  );
}
