/** Travel fee settings (/admin → Availability → Travel). */
export interface TravelSettings {
  /** Home-base ZIP code distances are measured from. */
  baseZip: string;
  /** Road miles included at no cost. */
  freeMiles: number;
  /** Price per road mile beyond the free miles (cents). */
  perMileCents: number;
  /** Homes farther than this can't book online (they text instead). */
  maxMiles: number;
}

/**
 * "free" / "fee": bookable; "too_far": farther than max miles; "outside_florida": not a Florida ZIP code;
 * "unknown_zip": a Florida ZIP code the Census list doesn't have (bookable, the owner confirms a fee);
 * "off": travel fees aren't set up in /admin yet.
 */
export type TravelStatus = "free" | "fee" | "too_far" | "outside_florida" | "unknown_zip" | "off";

/** A home's distance and travel fee (estimated from ZIP codes). */
export interface TravelQuote {
  status: TravelStatus;
  /** Estimated road miles from the home base (null when unknown). */
  miles: number | null;
  /** Whole dollars, in cents (0 unless status is "fee"). */
  feeCents: number;
  freeMiles: number | null;
  perMileCents: number | null;
  maxMiles: number | null;
}

/** Florida ZIP codes start with 320–349. */
export const isFloridaZip = (zip: string) => /^3[2-4]\d{3}/.test(zip.trim());

/** What a booking keeps: the fee charged and the estimated miles (feeCents null = fees were off; miles null = unknown). */
export interface BookingTravel {
  feeCents: number | null;
  miles: number | null;
}

export const bookingTravelOf = (q: TravelQuote): BookingTravel => (q.status === "off" ? { feeCents: null, miles: null } : { feeCents: q.feeCents, miles: q.miles });

/** A reference place with its distance and fee (/admin preview). */
export type TravelExample = TravelQuote & { place: string };
