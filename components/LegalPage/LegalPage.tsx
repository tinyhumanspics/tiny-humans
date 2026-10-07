import Link from "next/link";
import type { LegalDocument } from "@/config/legal";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import { site } from "@/config/site";
import type { ReactNode } from "react";
import styles from "./LegalPage.module.css";
import { cn } from "@/lib/cn";

/** Turns the business email and Instagram handle into links. */
function linkify(text: string): ReactNode[] {
  const { email } = site.contact;
  const { handle, url } = site.social.instagram;
  const tokens = [email, handle].filter(Boolean) as string[];
  if (!tokens.length) return [text];
  const re = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text.split(re).map((part, i) => {
    if (part === email) return <a key={i} href={`mailto:${email}`}>{part}</a>;
    if (part === handle) return <a key={i} href={url} target="_blank" rel="noopener noreferrer">{part}</a>;
    return part;
  });
}

/** Readable page for the Privacy Policy and Terms of Service. */
export default function LegalPage({ doc, other }: { doc: LegalDocument; other: { href: string; label: string } }) {
  return (
    <main id="top" className={cn("container", styles.page)}>
      <article className={styles.article}>
        <h1 className={cn(styles.title, "chalk")}>{doc.title}</h1>
        <ChalkDoodle name="underline" size={200} color="var(--accent)" strokeWidth={3} className={styles.underline} />
        <p className={cn(styles.updated, "chalk-soft")}>Last updated {doc.lastUpdated}</p>
        <p className={styles.intro}>{doc.intro}</p>
        {doc.sections.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2 className={cn(styles.heading, "chalk-soft")}>{section.heading}</h2>
            {section.body.map((block, i) =>
              typeof block === "string" ? (
                <p key={i}>{linkify(block)}</p>
              ) : (
                <ul key={i}>
                  {block.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
        <p className={cn(styles.other, "chalk-soft")}>
          See also our <Link href={other.href}>{other.label}</Link>.
        </p>
      </article>
    </main>
  );
}
