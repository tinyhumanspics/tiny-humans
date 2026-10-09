import type { Bundle, BundleTranslation } from "@/config/bundles";
import type { AppLocale } from "@/i18n/config";
import es from "@/messages/es.json";

export interface StoredBundleTranslation extends Omit<BundleTranslation, "features"> {
  bundleId: string;
  features: { position: number; text: string }[];
}

export class IncompleteCatalogTranslationError extends Error {
  constructor(public readonly bundleId: string) {
    super(`Bundle ${bundleId} does not have complete Spanish copy.`);
  }
}

const present = (value: string | null | undefined) => Boolean(value?.trim());

function requireMatchingOptional(bundleId: string, english: string | null | undefined, translated: string | null | undefined): void {
  if (present(english) !== present(translated)) throw new IncompleteCatalogTranslationError(bundleId);
}

function spanishDuration(minutes: number): string {
  if (minutes === 60) return es.catalog.durationHour;
  if (minutes > 0 && minutes % 60 === 0) return es.catalog.durationHours.replace("{hours}", String(minutes / 60));
  return es.catalog.durationMinutes.replace("{minutes}", String(minutes));
}

/**
 * Applies the owner-saved Spanish copy to shared bundle facts. A missing or partial active translation throws:
 * the future Spanish route must never quietly mix English into a public package card or booking.
 */
export function localizeCatalog(catalog: Bundle[], locale: AppLocale, translations: StoredBundleTranslation[]): Bundle[] {
  if (locale === "en") return catalog;
  const byBundle = new Map(translations.map((translation) => [translation.bundleId, translation]));
  return catalog.map((bundle) => {
    const translated = byBundle.get(bundle.id);
    if (!translated?.name.trim()) throw new IncompleteCatalogTranslationError(bundle.id);
    if (
      translated.features.length !== bundle.features.length
      || translated.features.some((feature, position) => feature.position !== position || !feature.text.trim())
    ) {
      throw new IncompleteCatalogTranslationError(bundle.id);
    }
    requireMatchingOptional(bundle.id, bundle.description, translated.description);
    requireMatchingOptional(bundle.id, bundle.badge, translated.badge);
    requireMatchingOptional(bundle.id, bundle.offer?.label, translated.offerLabel);

    const name = translated.name.trim();
    return {
      ...bundle,
      name,
      description: translated.description?.trim() || undefined,
      badge: translated.badge?.trim() || undefined,
      duration: spanishDuration(bundle.durationMinutes),
      features: translated.features.map((feature) => feature.text.trim()),
      locationNote: es.catalog.locationNote,
      cta: es.catalog.choose.replace("{name}", name),
      offer: bundle.offer
        ? {
            ...bundle.offer,
            label: bundle.offer.label ? translated.offerLabel?.trim() : es.catalog.specialOffer,
          }
        : bundle.offer,
    };
  });
}
