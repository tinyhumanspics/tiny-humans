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
}

export interface BundleOffer {
  enabled: boolean;
  /** Offer price in dollars (may include cents). */
  price: number;
  label?: string | null;
  /** Last day of the offer, YYYY-MM-DD (studio time zone). */
  endsOn?: string | null;
}

export const bundles: Bundle[] = [
  {
    id: "little-moments",
    name: "Little Moments",
    price: 99,
    duration: "Up to 45 minutes",
    durationMinutes: 45,
    people: "Baby only",
    setups: "1 setup",
    photos: "5–8",
    features: ["Up to 45 minutes", "Baby only", "1 setup", "5–8 edited digital photos"],
    locationNote: "We bring the studio to your home",
    cta: "Choose Little Moments",
  },
  {
    id: "our-little-story",
    name: "Our Little Story",
    price: 199,
    duration: "Up to 90 minutes",
    durationMinutes: 90,
    people: "Baby + parents + siblings",
    setups: "2 setups",
    photos: "15–20",
    features: ["Up to 90 minutes", "Baby + parents + siblings", "2 setups", "15–20 edited digital photos"],
    locationNote: "We bring the studio to your home",
    cta: "Choose Our Little Story",
    badge: "Most loved",
  },
  {
    id: "forever-little",
    name: "Forever Little",
    price: 249,
    duration: "Up to 2 hours",
    durationMinutes: 120,
    people: "Baby + parents + siblings",
    setups: "Up to 3 setups",
    photos: "25–35",
    features: ["Up to 2 hours", "Baby + parents + siblings", "Up to 3 setups", "25–35 edited digital photos"],
    locationNote: "We bring the studio to your home",
    cta: "Choose Forever Little",
  },
];

export function getBundle(id: string | null | undefined): Bundle | undefined {
  return bundles.find((b) => b.id === id);
}

export function formatPrice(price: number): string {
  return `$${price}`;
}
