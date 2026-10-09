export const site = {
  name: "Tiny Humans",
  description: "Newborn & baby photography made with love.",
  location: "Miami, Florida",
  /** Public site address (NEXT_PUBLIC_SITE_URL), used for links in emails and metadata. */
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://www.tinyhumans.photography",
  hero: {
    title: ["Tiny moments.", "Big memories."],
    subtitle: "Newborn & baby photography made with love.",
    /** What makes Tiny Humans different, shown under the hero text. */
    promise: "We bring the studio to your home, so your little one stays comfy.",
    primaryCta: { label: "Book a session", href: "/bundles" },
    secondaryCta: { label: "View our work", href: "#portfolio" },
  },
  sections: {
    portfolio: {
      id: "portfolio",
      title: "Little moments",
      subtitle: "A few favorites, all taken in families' own homes.",
    },
    book: {
      id: "book",
      title: "Let's make some memories",
      subtitle: "Pick a day and time, and we'll bring the studio to your door. It takes about two minutes.",
    },
  },
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
  /** Intro animation timing (milliseconds). */
  intro: {
    drawMs: 2400,
    moveMs: 1100,
    reducedMotionHoldMs: 250,
    reducedMotionMoveMs: 350,
  },
} as const;

export const navigation = [
  { message: "portfolio", href: "/#portfolio" },
  // Both lead to the bundles page: families pick a bundle, then the calendar.
  { message: "bundles", href: "/bundles" },
  { message: "book", href: "/bundles", emphasis: true },
] as const;
