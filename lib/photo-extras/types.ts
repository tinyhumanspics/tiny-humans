/**
 * Photo extras after the session (owner, Nov 20): extra edited photos (capped per booking), the full gallery
 * (color-corrected and retouched) and the unedited files. Prices and promises are the owner's, from /admin → Pricing.
 * Shared by the server, the extras page and /admin (no server-only imports).
 */
export interface ExtrasSettings {
  enabled: boolean;
  extraPhotoCents: number;
  /** Most extra edited photos per booking, across all its orders. */
  maxExtras: number;
  fullGalleryCents: number;
  rawFilesCents: number;
  /** Days the page stays open after the sneak-peek email. */
  openDays: number;
  extrasDeliveryHours: number;
  fullDeliveryDays: number;
  rawDeliveryHours: number;
}

export type ExtraKind = "extra_photos" | "full_gallery" | "unedited_files";
export const EXTRA_KINDS: readonly ExtraKind[] = ["extra_photos", "full_gallery", "unedited_files"];

/** When a line arrives after payment, as promised when it was bought. */
export interface Delivery {
  amount: number;
  unit: "hours" | "days";
}

/** One line of an order, copied in at checkout. */
export interface ExtraLine {
  kind: ExtraKind;
  quantity: number;
  unitCents: number;
  totalCents: number;
  delivery: Delivery;
}

/** What the family picks on the page. */
export interface ExtrasChoice {
  extras: number;
  full: boolean;
  raw: boolean;
}

/** What earlier paid orders already bought. */
export interface ExtrasBought {
  extras: number;
  /** Paid for extra photos so far (it's taken off the full gallery). */
  extrasPaidCents: number;
  full: boolean;
  raw: boolean;
}

/** What's still on offer for a booking. */
export interface ExtrasLeft {
  extrasLeft: number;
  canFull: boolean;
  canRaw: boolean;
  /** Taken off the full gallery: what they already paid for extra photos. */
  fullCreditCents: number;
  nothingLeft: boolean;
}

/** An order as /admin → Leads shows it. */
export interface LeadExtrasOrder {
  id: string;
  lines: ExtraLine[];
  creditCents: number;
  totalCents: number;
  note: string | null;
  status: "open" | "paid" | "refunded";
  createdAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
}

/** The extras page's state (GET /api/extras). */
export type ExtrasView =
  | { state: "invalid" }
  | { state: "closed" }
  | {
      state: "open" | "nothing" | "paid";
      firstName: string;
      bundleName: string;
      /** The bundle's edited photos ("20"). */
      included: string | null;
      prices: Pick<ExtrasSettings, "extraPhotoCents" | "maxExtras" | "fullGalleryCents" | "rawFilesCents">;
      left: ExtrasLeft;
      /** Shown after paying ("paid"): the newest paid order. */
      paidOrder?: { lines: ExtraLine[]; creditCents: number; totalCents: number };
    };
