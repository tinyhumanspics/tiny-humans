import type { PortfolioPhoto } from "@/config/portfolio";
import { allMediaPhotos } from "@/lib/settings/defaults";
import type { SiteSettings } from "@/lib/settings/types";

/**
 * Fills the Spanish side of whatever the owner adds in /admin, at save time (owner, Nov 9): a new photo's title,
 * description and caption, a prompt box, a seasonal offer, a bundle's name, description, small label, offer label
 * and included items. Only EMPTY Spanish fields are filled; anything the owner typed in Spanish is kept as is.
 * `translate` turns English into Spanish (lib/i18n/autotranslate.ts; it copies the English when translation is off).
 * Pure apart from `translate`, so it's unit tested with a fake.
 */
export type Translate = (texts: string[]) => Promise<string[]>;

/** Photo names that are codes or file names ("C225", "IMG_7378", "DSC-0042.jpg") stay exactly as they are. */
export function looksLikeCode(text: string): boolean {
  const t = text.trim();
  return /^[A-Za-z]{0,6}[\s_-]?\d[\w-]*$/.test(t) || /^[\w-]+\.(jpe?g|png|webp|heic|gif)$/i.test(t);
}

/** A translation longer than the Spanish field allows: the English if it fits, else cut at the last whole word. */
export function fit(spanish: string, english: string, max: number): string {
  if (spanish.length <= max) return spanish;
  if (english.length <= max) return english;
  const cut = spanish.slice(0, max);
  return (cut.lastIndexOf(" ") > max * 0.6 ? cut.slice(0, cut.lastIndexOf(" ")) : cut).trim();
}

/** Collects English texts, translates them in one go, then hands each result back to its setter. */
class Batch {
  private jobs: { text: string; set: (spanish: string) => void }[] = [];
  add(text: string | null | undefined, set: (spanish: string) => void) {
    if (text?.trim()) this.jobs.push({ text: text.trim(), set });
  }
  get size() {
    return this.jobs.length;
  }
  async run(translate: Translate) {
    if (!this.jobs.length) return;
    const out = await translate(this.jobs.map((j) => j.text));
    this.jobs.forEach((j, i) => j.set(out[i]?.trim() || j.text));
  }
}

const empty = (v: string | null | undefined) => !v?.trim();

/**
 * Settings (photos in every theme and section, prompt boxes, seasonal offers): the Spanish of anything new.
 * Field limits match lib/settings/defaults.ts parseSettings (Spanish title 60, description 160, caption 40;
 * prompt title 60 / text 120; offer title 90 / description 240).
 */
export async function autofillSettingsSpanish(input: SiteSettings, translate: Translate): Promise<{ settings: SiteSettings; filled: number }> {
  const settings: SiteSettings = structuredClone(input);
  const batch = new Batch();

  // the same photo can appear in several places (and themes): translate each text once, fill every copy
  for (const photo of allMediaPhotos(settings) as PortfolioPhoto[]) {
    const s = photo.spanish ?? null;
    const caption = photo.caption?.trim();
    if (s && !empty(s.title) && !empty(s.alt) && (!caption || !empty(s.caption))) continue;
    const next = { title: s?.title ?? "", alt: s?.alt ?? "", caption: s?.caption };
    photo.spanish = next;
    if (empty(next.title)) batch.add(photo.title, (es) => (next.title = fit(es, photo.title, 60)));
    if (empty(next.alt)) batch.add(photo.alt || photo.title, (es) => (next.alt = fit(es, photo.alt || photo.title, 160)));
    if (caption && empty(next.caption)) batch.add(caption, (es) => (next.caption = fit(es, caption, 40)));
  }

  for (const media of Object.values(settings.media)) {
    for (const section of media?.sections ?? []) {
      if (!section.prompt || !section.title?.trim() || !section.text?.trim()) continue;
      if (section.spanish && !empty(section.spanish.title) && !empty(section.spanish.text)) continue;
      const next = { title: section.spanish?.title ?? "", text: section.spanish?.text ?? "" };
      section.spanish = next;
      if (empty(next.title)) batch.add(section.title, (es) => (next.title = fit(es, section.title!, 60)));
      if (empty(next.text)) batch.add(section.text, (es) => (next.text = fit(es, section.text!, 120)));
    }
  }

  for (const offer of Object.values(settings.seasonalOffers)) {
    if (!offer.title.trim() || !offer.description.trim()) continue;
    if (offer.spanish && !empty(offer.spanish.title) && !empty(offer.spanish.description)) continue;
    const next = { title: offer.spanish?.title ?? "", description: offer.spanish?.description ?? "" };
    offer.spanish = next;
    if (empty(next.title)) batch.add(offer.title, (es) => (next.title = fit(es, offer.title, 90)));
    if (empty(next.description)) batch.add(offer.description, (es) => (next.description = fit(es, offer.description, 240)));
  }

  const filled = batch.size;
  await batch.run(translate);
  return { settings, filled };
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * A bundle as /admin → Pricing sends it, before it's checked: every empty Spanish field gets the Spanish of its
 * English pair (name 60, description 200, small label 24, offer label 30, each included item 80); a Spanish field
 * whose English was cleared is cleared too. So a bundle always saves with complete Spanish, and nothing the owner
 * typed in Spanish is replaced.
 */
export async function autofillBundleSpanish(raw: unknown, translate: Translate): Promise<unknown> {
  if (!raw || typeof raw !== "object") return raw;
  const b = raw as Record<string, unknown>;
  const name = str(b.name);
  if (!name) return raw; // the check that follows explains what's missing
  const description = str(b.description);
  const badge = str(b.badge);
  const offerLabel = str((b.offer as Record<string, unknown> | null | undefined)?.label);
  const features = Array.isArray(b.features) ? b.features.map(str) : [];
  const s = b.spanish && typeof b.spanish === "object" ? (b.spanish as Record<string, unknown>) : {};
  const sFeatures = Array.isArray(s.features) ? s.features.map(str) : [];

  const next = {
    name: str(s.name),
    description: description ? str(s.description) : "",
    badge: badge ? str(s.badge) : "",
    offerLabel: offerLabel ? str(s.offerLabel) : "",
    features: features.map((_, i) => sFeatures[i] ?? ""),
  };
  const batch = new Batch();
  if (next.name.length < 2) batch.add(name, (es) => (next.name = fit(es, name, 60)));
  if (description && !next.description) batch.add(description, (es) => (next.description = fit(es, description, 200)));
  if (badge && !next.badge) batch.add(badge, (es) => (next.badge = fit(es, badge, 24)));
  if (offerLabel && !next.offerLabel) batch.add(offerLabel, (es) => (next.offerLabel = fit(es, offerLabel, 30)));
  features.forEach((f, i) => {
    if (f && !next.features[i]) batch.add(f, (es) => (next.features[i] = fit(es, f, 80)));
  });
  await batch.run(translate);

  return {
    ...b,
    spanish: { name: next.name, description: next.description || null, badge: next.badge || null, offerLabel: next.offerLabel || null, features: next.features },
  };
}
