import "server-only";
import { FL_ZIP_CENTROIDS } from "./fl-zips";
import { isFloridaZip, type TravelQuote, type TravelSettings } from "./types";

/**
 * Road miles ≈ straight-line miles between ZIP code centers × 1.15 (Florida highway trips from Miami Beach run about
 * 1.15–1.2×; the lower end so the estimate leans in the family's favor). Fees round down to whole dollars.
 */
export const ROAD_FACTOR = 1.15;
const EARTH_MILES = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

const centroid = (zip: string) => (Object.hasOwn(FL_ZIP_CENTROIDS, zip) ? FL_ZIP_CENTROIDS[zip] : null);
export const isKnownFloridaZip = (zip: string) => centroid(zip) !== null;

/** Estimated road miles between two Florida ZIP codes (null if either isn't in the list). */
export function roadMiles(fromZip: string, toZip: string): number | null {
  const a = centroid(fromZip);
  const b = centroid(toZip);
  if (!a || !b) return null;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return Math.round(2 * EARTH_MILES * Math.asin(Math.sqrt(h)) * ROAD_FACTOR);
}

/** Distance and travel fee for a home's ZIP code with the owner's settings (null settings = fees off). */
export function travelQuote(zipInput: string, settings: TravelSettings | null): TravelQuote {
  const zip = zipInput.trim().slice(0, 5);
  const terms = { freeMiles: settings?.freeMiles ?? null, perMileCents: settings?.perMileCents ?? null, maxMiles: settings?.maxMiles ?? null };
  if (!isFloridaZip(zip)) return { status: "outside_florida", miles: null, feeCents: 0, ...terms };
  if (!settings) return { status: "off", miles: null, feeCents: 0, ...terms };
  const miles = roadMiles(settings.baseZip, zip);
  if (miles === null) return { status: "unknown_zip", miles: null, feeCents: 0, ...terms };
  if (miles > settings.maxMiles) return { status: "too_far", miles, feeCents: 0, ...terms };
  const feeCents = Math.floor((Math.max(0, miles - settings.freeMiles) * settings.perMileCents) / 100) * 100;
  return { status: feeCents > 0 ? "fee" : "free", miles, feeCents, ...terms };
}
