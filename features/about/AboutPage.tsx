import en from "@/messages/en.json";
import { bundlesHref } from "@/config/booking";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import PhotoPlaceholder from "@/components/PhotoPlaceholder/PhotoPlaceholder";
import Reveal from "@/components/Reveal/Reveal";
import SectionHeading from "@/components/SectionHeading/SectionHeading";
import styles from "./About.module.css";

const t = en.about;
const whyDoodles = ["house", "heart", "sun"] as const;

/**
 * /about: the story behind Tiny Humans (linked from the footer only). Copy from the owner's answers, in messages/en.json.
 * Photos are placeholders until the owner uploads them (later: editable in /admin, "Meet the photographers").
 */
export default function AboutPage() {
  return (
    <main id="top" className={styles.page}>
      {/* Hello */}
      <section className={`container ${styles.hero}`}>
        <div className={styles.heroText}>
          <p className={`${styles.eyebrow} chalk-soft`}>{t.hero.eyebrow}</p>
          <h1 className={`${styles.title} chalk`}>{t.hero.title}</h1>
          <ChalkDoodle name="underline" size={220} color="var(--accent)" strokeWidth={3} className={styles.underline} />
          <p className={`${styles.lead} chalk-soft`}>{t.hero.intro}</p>
        </div>
        <Reveal className={styles.heroPhoto}>
          <PhotoPlaceholder label={t.hero.photo} ratio={4 / 5} seed={501} tape="yellow" />
        </Reveal>
      </section>

      {/* How it started */}
      <section className={`container ${styles.section} ${styles.story}`} aria-labelledby="about-story">
        <Reveal className={styles.storyPhoto}>
          <PhotoPlaceholder label={t.story.photo} ratio={3 / 2} seed={511} tape="blue" />
        </Reveal>
        <div>
          <h2 id="about-story" className={`${styles.heading} chalk`}>{t.story.title}</h2>
          {t.story.paragraphs.map((p, i) => (
            <p key={i} className={`${styles.text} ${i === 1 ? styles.punch : ""} chalk-soft`}>{p}</p>
          ))}
        </div>
      </section>

      {/* Why at home */}
      <section className={`container ${styles.section}`} aria-labelledby="about-why">
        <SectionHeading id="about-why" title={t.why.title} slot="book" />
        <ul className={styles.cards}>
          {t.why.items.map((item, i) => (
            <Reveal as="li" key={item.title} delay={i * 110}>
              <ChalkBox className={styles.card} seed={520 + i} wobble={2.6} strokeWidth={2.4}>
                <ChalkDoodle name={whyDoodles[i % whyDoodles.length]} size={34} color={i === 1 ? "var(--accent-2)" : "var(--sun-yellow)"} strokeWidth={3} grain={false} />
                <h3 className={`${styles.cardTitle} chalk-soft`}>{item.title}</h3>
                <p className="chalk-soft">{item.text}</p>
              </ChalkBox>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* The two of us */}
      <section className={`container ${styles.section}`} aria-labelledby="about-team">
        <SectionHeading id="about-team" title={t.team.title} slot="portfolio" />
        <ul className={styles.team}>
          {t.team.people.map((person, i) => (
            <Reveal as="li" key={person.name} delay={i * 120} className={styles.person}>
              <PhotoPlaceholder label={person.photo} ratio={4 / 5} seed={530 + i} tape={i === 0 ? "white" : "yellow"} />
              <h3 className={`${styles.personName} chalk`}>{person.name}</h3>
              <p className={`${styles.role} chalk-soft`}>{person.role}</p>
              <p className={`${styles.text} chalk-soft`}>{person.text}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Safety */}
      <section className={`container ${styles.section}`} aria-labelledby="about-safety">
        <Reveal>
          <ChalkBox className={styles.safety} seed={541} wobble={2.6} strokeWidth={2.4}>
            <h2 id="about-safety" className={`${styles.heading} chalk`}>{t.safety.title}</h2>
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
      <section className={`container ${styles.section} ${styles.ctaSection}`} aria-labelledby="about-cta">
        <Reveal>
          <ChalkBox className={styles.cta} seed={551} wobble={3} strokeWidth={3} color="var(--sun-yellow)">
            <ChalkDoodle name="heart" size={40} color="var(--accent-2)" strokeWidth={3} />
            <h2 id="about-cta" className={`${styles.heading} chalk`}>{t.cta.title}</h2>
            <p className={`${styles.text} chalk-soft`}>{t.cta.text}</p>
            <ChalkButton href={bundlesHref()} variant="solid" seed={552}>{t.cta.button}</ChalkButton>
            <p className={`${styles.spanish} chalk-soft`}>{t.cta.spanish}</p>
          </ChalkBox>
        </Reveal>
      </section>
    </main>
  );
}
