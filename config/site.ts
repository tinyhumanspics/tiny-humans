export const site = {
  name: "Tiny Humans",
  location: "Miami, Florida",
  /** Public site address (NEXT_PUBLIC_SITE_URL), used for links in emails and metadata. */
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://www.tinyhumans.photography",
  /** Footer: social + contact. */
  social: {
    instagram: { label: "Instagram", handle: "@tinyhumans.photography" as string | null, url: "https://www.instagram.com/tinyhumans.photography/" },
  },
  contact: {
    email: "hello@tinyhumans.photography" as string | null,
    /** Texting number for families (owner decision 13), shown in emails. */
    phone: "(786) 222-7194",
    sms: "+17862227194",
  },
  /**
   * Cities in the home page's search-engine data (JSON-LD areaServed): the whole area served, Miami to Orlando. The ad
   * page lists only the Miami areas it advertises (messages landing.area.cities).
   */
  areaServed: ["Miami", "Miami Beach", "Aventura", "North Miami", "Coral Gables", "Doral", "Kendall", "Hialeah", "Hollywood", "Fort Lauderdale", "Boca Raton", "West Palm Beach", "Port St. Lucie", "Orlando"],
  /** Intro animation timing (milliseconds). */
  intro: {
    drawMs: 2400,
    moveMs: 1100,
    reducedMotionHoldMs: 250,
    reducedMotionMoveMs: 350,
  },
} as const;

export const navigation = [
  { message: "home", href: "/" },
  // the portfolio is its own page (owner, Nov 16)
  { message: "portfolio", href: "/portfolio" },
  { message: "bundles", href: "/bundles" },
  // straight to /book: the bundles and the calendar are on its first screen (owner, Nov 16; brief 05)
  { message: "book", href: "/book", emphasis: true },
] as const;
