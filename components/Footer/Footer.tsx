"use client";

import Link from "next/link";
import { site } from "@/config/site";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import { IS_PROTOTYPE } from "@/lib/admin/client";
import type en from "@/messages/en.json";
import type { AppLocale } from "@/i18n/config";
import { localePath } from "@/i18n/path";
import styles from "./Footer.module.css";
import { cn } from "@/lib/cn";

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

export default function Footer({ messages, locale }: { messages: typeof en.footer; locale: AppLocale }) {
  const { instagram } = site.social;
  const { email } = site.contact;
  return (
    <footer className={styles.footer}>
      <div className={cn("container", styles.columns)}>
        <nav aria-labelledby="footer-about" className={styles.col}>
          <h2 id="footer-about" className={cn(styles.heading, "chalk-soft")}>{messages.about.heading}</h2>
          <ul className={styles.list}>
            <li>
              <Link href={localePath("/about", locale)} prefetch={false} className={cn(styles.link, "chalk-soft")}>{messages.about.story}</Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-legal" className={styles.col}>
          <h2 id="footer-legal" className={cn(styles.heading, "chalk-soft")}>{messages.legal.heading}</h2>
          <ul className={styles.list}>
            <li>
              <Link href={localePath("/privacy", locale)} prefetch={false} className={cn(styles.link, "chalk-soft")}>{messages.legal.privacy}</Link>
            </li>
            <li>
              <Link href={localePath("/terms", locale)} prefetch={false} className={cn(styles.link, "chalk-soft")}>{messages.legal.terms}</Link>
            </li>
          </ul>
        </nav>

        <div className={styles.col}>
          <h2 className={cn(styles.heading, "chalk-soft")}>{messages.social.heading}</h2>
          <a href={instagram.url} target="_blank" rel="noopener noreferrer" className={cn(styles.link, styles.iconLink, "chalk-soft")}>
            <ChalkDoodle name="instagram" size={26} color="var(--accent)" strokeWidth={3} />
            <span>{instagram.handle ?? instagram.label}</span>
            <span className="visually-hidden"> ({messages.social.newTab})</span>
          </a>
        </div>

        <div className={styles.col}>
          <h2 className={cn(styles.heading, "chalk-soft")}>{messages.contact.heading}</h2>
          {email ? (
            <a href={`mailto:${email}`} className={cn(styles.link, styles.iconLink, "chalk-soft")}>
              <ChalkDoodle name="mail" size={26} color="var(--accent-2)" strokeWidth={3} />
              <span>{email}</span>
            </a>
          ) : (
            <p className={cn(styles.note, "chalk-soft")}>
              <ChalkDoodle name="mail" size={26} color="var(--accent-2)" strokeWidth={3} />
              <span>{messages.contact.emailMissing}</span>
            </p>
          )}
        </div>
      </div>

      <div className={cn("container", styles.bottom, "chalk-soft")}>
        <ChalkDoodle name="heart" size={20} color="var(--accent-2)" />
        <p>{fill(messages.copyright, { year: String(new Date().getFullYear()), brand: site.name, location: site.location })}</p>
        {/* The real site has no public link to the owner area; it lives at /admin. */}
        {IS_PROTOTYPE && (
          <p className={styles.owner}>
            <Link href="/admin">{messages.owner}</Link>
          </p>
        )}
      </div>
    </footer>
  );
}
