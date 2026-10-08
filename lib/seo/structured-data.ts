import { site } from "@/config/site";
import en from "@/messages/en.json";
import { DEFAULT_SITE_DESCRIPTION, PUBLIC_SITE_URL, SOCIAL_IMAGE } from "./metadata";

/** Honest service-area business data only; no reviews, hours, prices or street address are invented. */
export function serviceBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${PUBLIC_SITE_URL}/#business`,
    name: site.name,
    description: DEFAULT_SITE_DESCRIPTION,
    url: `${PUBLIC_SITE_URL}/`,
    image: SOCIAL_IMAGE.url,
    logo: `${PUBLIC_SITE_URL}/brand/default/logo-full.jpg`,
    telephone: site.contact.sms,
    email: site.contact.email,
    sameAs: [site.social.instagram.url],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Miami Beach",
      addressRegion: "FL",
      addressCountry: "US",
    },
    areaServed: en.landing.area.cities.map((name) => ({
      "@type": "City",
      name,
      containedInPlace: { "@type": "State", name: "Florida" },
    })),
  };
}

/** Next.js recommends escaping `<` before placing JSON-LD in an inline script. */
export const serializeJsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
