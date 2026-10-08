import "server-only";
import { travelQuote } from "./distance";
import type { TravelExample, TravelSettings } from "./types";

/** Reference places for the /admin preview ("West Palm Beach ≈ 69 miles → $29"). */
const PLACES: [string, string][] = [
  ["Fort Lauderdale", "33301"],
  ["Boca Raton", "33432"],
  ["West Palm Beach", "33401"],
  ["Naples", "34102"],
  ["Orlando", "32801"],
  ["Tampa", "33602"],
];

export const travelExamples = (s: TravelSettings | null): TravelExample[] =>
  s ? PLACES.map(([place, zip]) => ({ place, ...travelQuote(zip, s) })) : [];
