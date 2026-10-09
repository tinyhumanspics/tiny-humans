import en from "@/messages/en.json";
import { bundlesHref } from "@/config/booking";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import SitePhotoSlot from "@/components/SitePhotoSlot/SitePhotoSlot";
import Reveal from "@/components/Reveal/Reveal";
import SectionHeading from "@/components/SectionHeading/SectionHeading";
import styles from "./About.module.css";
import { cn } from "@/lib/cn";
import type { AppLocale } from "@/i18n/config";

const whyDoodles = ["house", "heart", "sun"] as const;

/**
 * /about: the story behind Tiny Humans (linked from the footer only). Copy from the owner's answers, in messages/en.json.
 * Photos stay as placeholders until the owner uploads replacements in /admin → Photos.
 */
export default function AboutPage({ messages = en.about, photoMessages = en.photoPlaceholder, ctaText, locale = "en" }: { messages?: typeof en.about; photoMessages?: typeof en.photoPlaceholder; ctaText?: string; locale?: AppLocale }) {
  const t = messages;
  const closingText = ctaText ?? t.cta.text;
  return (
    <main id="top" className={styles.page}>
      {/* Hello */}
      <section className={cn("container", styles.hero)}>
        <div className={styles.heroText}>
          <p className={cn(styles.eyebrow, "chalk-soft")}>{t.hero.eyebrow}</p>
          <h1 className={cn(styles.title, "chalk")}>{t.hero.title}</h1>
          <ChalkDoodle name="underline" size={220} color="var(--accent)" strokeWidth={3} className={styles.underline} />
          <p className={cn(styles.lead, "chalk-soft")}>{t.hero.intro}</p>
        </div>
        <Reveal className={styles.heroPhoto}>
          <SitePhotoSlot group="about" index={0} placeholderLabel={t.hero.photo} placeholderMessages={photoMessages} ratio={4 / 5} seed={501} sizes="(min-width: 860px) 420px, 100vw" priority tape="yellow" />
        </Reveal>
      </section>

      {/* How it started */}
      <section className={cn("container", styles.section, styles.story)} aria-labelledby="about-story">
        <Reveal className={styles.storyPhoto}>
          <SitePhotoSlot group="about" index={1} placeholderLabel={t.story.photo} placeholderMessages={photoMessages} ratio={3 / 2} seed={511} sizes="(min-width: 860px) 480px, 100vw" tape="blue" />
        </Reveal>
        <div>
          <h2 id="about-story" className={cn(styles.heading, "chalk")}>{t.story.title}</h2>
          {t.story.paragraphs.map((p, i) => (
            <p key={i} className={cn(styles.text, i === 1 ? styles.punch : "", "chalk-soft")}>{p}</p>
          ))}
        </div>
      </section>

      {/* Why at home */}
      <section className={cn("container", styles.section)} aria-labelledby="about-why">
        <SectionHeading id="about-why" title={t.why.title} slot="book" />
        <ul className={styles.cards}>
          {t.why.items.map((item, i) => (
            <Reveal as="li" key={item.title} delay={i * 110}>
              <ChalkBox className={styles.card} seed={520 + i} wobble={2.6} strokeWidth={2.4}>
                <ChalkDoodle name={whyDoodles[i % whyDoodles.length]} size={34} color={i === 1 ? "var(--accent-2)" : "var(--sun-yellow)"} strokeWidth={3} grain={false} />
                <h3 className={cn(styles.cardTitle, "chalk-soft")}>{item.title}</h3>
                <p className="chalk-soft">{item.text}</p>
              </ChalkBox>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* The two of us */}
      <section className={cn("container", styles.section)} aria-labelledby="about-team">
        <SectionHeading id="about-team" title={t.team.title} slot="portfolio" />
        <ul className={styles.team}>
          {t.team.people.map((person, i) => (
            <Reveal as="li" key={person.name} delay={i * 120} className={styles.person}>
              <SitePhotoSlot group="about" index={i + 2} placeholderLabel={person.photo} placeholderMessages={photoMessages} ratio={4 / 5} seed={530 + i} sizes="(min-width: 720px) 440px, 100vw" tape={i === 0 ? "white" : "yellow"} />
              <h3 className={cn(styles.personName, "chalk")}>{person.name}</h3>
              <p className={cn(styles.role, "chalk-soft")}>{person.role}</p>
              <p className={cn(styles.text, "chalk-soft")}>{person.text}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Safety */}
      <section className={cn("container", styles.section)} aria-labelledby="about-safety">
        <Reveal>
          <ChalkBox className={styles.safety} seed={541} wobble={2.6} strokeWidth={2.4}>
            <h2 id="about-safety" className={cn(styles.heading, "chalk")}>{t.safety.title}</h2>
            <ul className={styles.checks}>
              {t.safety.items.map((item) => (
                <li key={item}>
                  <ChalkDoodle name="check" size={24} color="var(--sun-yellow)" strokeWidth={3} grain={false} />
                  <span className="chalk-soft">{item}</span>
                </li>
              ))}
            </ul>
          </ChalkBox>
        </Reveal>
      </section>

      {/* Book */}
      <section className={cn("container", styles.section, styles.ctaSection)} aria-labelledby="about-cta">
        <Reveal>
          <ChalkBox className={styles.cta} seed={551} wobble={3} strokeWidth={3} color="var(--sun-yellow)">
            <ChalkDoodle name="heart" size={40} color="var(--accent-2)" strokeWidth={3} />
            <h2 id="about-cta" className={cn(styles.heading, "chalk")}>{t.cta.title}</h2>
            <p className={cn(styles.text, "chalk-soft")}>{closingText}</p>
            <ChalkButton href={bundlesHref(undefined, locale)} variant="solid" seed={552}>{t.cta.button}</ChalkButton>
            <p className={cn(styles.spanish, "chalk-soft")}>{t.cta.spanish}</p>
          </ChalkBox>
        </Reveal>
      </section>
    </main>
  );
}
