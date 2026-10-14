import type { CodeTerms } from "./engine";

/** A bundle as customers see it. The live bundles are owner-managed in /admin/pricing and stored in Neon. */
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

/** A discount code as the owner manages it (internal note is admin-only). */
export interface DiscountCode {
  id: string;
  code: string;
  type: "percent" | "fixed";
  /** percent: 1-100; fixed: dollars (may include cents) */
  value: number;
  bundleIds: string[];
  active: boolean;
  expiresOn: string | null;
  maxUses: number | null;
  onePerEmail: boolean;
  internalNote: string | null;
  usesCount: number;
  createdAt: string;
}

export type CodeCheck = { ok: true; terms: CodeTerms; codeId: string } | { ok: false; message: string };

/** Where providers get bundles + codes (Neon, or the built-in bundles without a database). */
export interface PricingAdapter {
  bundles(): Promise<Bundle[]>;
  validateCode(code: string, bundleId: string, email?: string): Promise<CodeCheck>;
  /** Reserve one use (atomic). Returns a release function for rollbacks. */
  claimCode?(codeId: string, email: string): Promise<{ usageId: string; release: () => Promise<void> }>;
}

export const CODE_MESSAGES = {
  notFound: "We couldn't find that code. Please check the spelling and try again.",
  inactive: "That code isn't active right now.",
  expired: "That code has expired.",
  notForBundle: "That code doesn't apply to this bundle.",
  maxed: "That code has reached its limit and can't be used anymore.",
  usedByEmail: "That code has already been used with this email address.",
};
