export interface Bundle {
  id: string;
  name: string;
  price: number;
  duration: string;
  /** Session length in minutes, used for booking availability. */
  durationMinutes: number;
  /** Who can be in the photos. */
  people: string;
  setups: string;
  /** Number (or range) of edited photos, e.g. "5–8". */
  photos: string;
  features: string[];
  locationNote: string;
  cta: string;
  /** Optional small chalk label, e.g. "Most loved". */
  badge?: string;
  /** Optional short description (owner-editable). */
  description?: string;
  /** Inactive bundles are hidden from the public site (kept for history). */
  active?: boolean;
  sortOrder?: number;
  /** Special offer (owner-editable). Active only while enabled and today <= endsOn. */
  offer?: BundleOffer | null;
  /** Twins/triplets option, owner-editable per bundle. One unit = one baby after the first. */
  extraBaby?: ExtraBabyAddon | null;
}

/** Owner-editable customer copy for one translated bundle. Prices and other booking facts stay on Bundle. */
export interface BundleTranslation {
  name: string;
  description?: string;
  badge?: string;
  offerLabel?: string;
  features: string[];
}

/** The owner API includes translation drafts; public catalog responses do not. */
export interface AdminBundle extends Bundle {
  spanish: BundleTranslation | null;
}

export interface ExtraBabyAddon {
  active: boolean;
  /** Dollars per baby after the first; never reduced by a bundle offer or discount code. */
  price: number;
  extraMinutes: number;
  extraPhotos: number;
  /** Maximum babies in one session (1 + the stored add-on quantity). */
  maxBabies: number;
}

export interface BundleOffer {
  enabled: boolean;
  /** Offer price in dollars (may include cents). */
  price: number;
  label?: string | null;
  /** Last day of the offer, YYYY-MM-DD (studio time zone). */
  endsOn?: string | null;
}

/**
 * LOCAL DEVELOPMENT / PROTOTYPE ONLY. The live bundles are managed in /admin/pricing and stored in Neon
 * (tables `bundles`, `bundle_inclusions`). This copy mirrors them (as of 2026-10-06) so local previews look
 * like production; it is never shown when a database is configured. Removed in Phase 8.
 */
export const bundles: Bundle[] = [
  {
    id: "little-moments",
    name: "Little Moments",
    price: 149,
    duration: "Up to 1 hour",
    durationMinutes: 60,
    people: "Baby only",
    setups: "1 setup",
    photos: "8",
    features: ["Up to 1 hour", "Baby only", "1 setup", "8 edited digital photos"],
    locationNote: "We bring the studio to your home",
    cta: "Choose Little Moments",
    extraBaby: { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 },
  },
  {
    id: "our-little-story",
    name: "Our Little Story",
    price: 249,
    duration: "Up to 2 hours",
    durationMinutes: 120,
    people: "Baby only",
    setups: "2 setups",
    photos: "20",
    features: ["Up to 2 hours", "Baby only", "2 setups", "20 edited digital photos"],
    locationNote: "We bring the studio to your home",
    cta: "Choose Our Little Story",
    badge: "Most loved",
    extraBaby: { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 },
  },
  {
    id: "forever-little",
    name: "Our Family Story",
    price: 399,
    duration: "Up to 3 hours",
    durationMinutes: 180,
    people: "Baby + parents + siblings",
    setups: "3 setups",
    photos: "35",
    features: ["Up to 3 hours", "Baby + parents + siblings", "3 setups", "35 edited digital photos"],
    locationNote: "We bring the studio to your home",
    cta: "Choose Our Family Story",
    extraBaby: { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 },
  },
];

export function getBundle(id: string | null | undefined): Bundle | undefined {
  return bundles.find((b) => b.id === id);
}

export function formatPrice(price: number): string {
  return `$${price}`;
}
