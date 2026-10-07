"use client";

import Link from "next/link";
import { site } from "@/config/site";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import { IS_PROTOTYPE } from "@/lib/admin/client";
import en from "@/messages/en.json";
import styles from "./Footer.module.css";

export default function Footer() {
  const { instagram } = site.social;
  const { email } = site.contact;
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.columns}`}>
        <nav aria-labelledby="footer-about" className={styles.col}>
          <h2 id="footer-about" className={`${styles.heading} chalk-soft`}>{en.footer.about.heading}</h2>
          <ul className={styles.list}>
            <li>
              <Link href="/about" prefetch={false} className={`${styles.link} chalk-soft`}>{en.footer.about.story}</Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-legal" className={styles.col}>
          <h2 id="footer-legal" className={`${styles.heading} chalk-soft`}>The fine print</h2>
          <ul className={styles.list}>
            <li>
              <Link href="/privacy" prefetch={false} className={`${styles.link} chalk-soft`}>Privacy Policy</Link>
            </li>
            <li>
              <Link href="/terms" prefetch={false} className={`${styles.link} chalk-soft`}>Terms of Service</Link>
            </li>
          </ul>
        </nav>

        <div className={styles.col}>
          <h2 className={`${styles.heading} chalk-soft`}>Follow us</h2>
          <a href={instagram.url} target="_blank" rel="noopener noreferrer" className={`${styles.link} ${styles.iconLink} chalk-soft`}>
            <ChalkDoodle name="instagram" size={26} color="var(--accent)" strokeWidth={3} />
            <span>{instagram.handle ?? instagram.label}</span>
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </div>

        <div className={styles.col}>
          <h2 className={`${styles.heading} chalk-soft`}>Contact us</h2>
          {email ? (
            <a href={`mailto:${email}`} className={`${styles.link} ${styles.iconLink} chalk-soft`}>
              <ChalkDoodle name="mail" size={26} color="var(--accent-2)" strokeWidth={3} />
              <span>{email}</span>
            </a>
          ) : (
            <p className={`${styles.note} chalk-soft`}>
              <ChalkDoodle name="mail" size={26} color="var(--accent-2)" strokeWidth={3} />
              <span>Email coming soon. Message us on Instagram in the meantime.</span>
            </p>
          )}
        </div>
      </div>

      <div className={`container ${styles.bottom} chalk-soft`}>
        <ChalkDoodle name="heart" size={20} color="var(--accent-2)" />
        <p>
          &copy; {new Date().getFullYear()} {site.name}, newborn &amp; baby photography in {site.location}.
        </p>
        {/* The real site has no public link to the owner area; it lives at /admin. */}
        {IS_PROTOTYPE && (
          <p className={styles.owner}>
            <Link href="/admin">Owner area (prototype only)</Link>
          </p>
        )}
      </div>
    </footer>
  );
}
