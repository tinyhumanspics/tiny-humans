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
