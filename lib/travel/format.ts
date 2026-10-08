import en from "@/messages/en.json";
import { site } from "@/config/site";
import { formatMoney } from "@/lib/pricing/engine";
import { fill } from "@/lib/email/messages";
import type { TravelQuote } from "./types";

const t = en.booking.travel;

/** The line under the ZIP box. "blocking": the family can't book online (not Florida, or too far). */
export function travelHint(q: TravelQuote): { text: string; blocking: boolean } | null {
  switch (q.status) {
    case "free":
      return { text: fill(t.free, { free: String(q.freeMiles) }), blocking: false };
    case "fee":
      return { text: fill(t.fee, { miles: String(q.miles), fee: formatMoney(q.feeCents), free: String(q.freeMiles) }), blocking: false };
    case "too_far":
      return { text: fill(t.tooFar, { phone: site.contact.phone }), blocking: true };
    case "outside_florida":
      return { text: t.outsideFlorida, blocking: true };
    case "unknown_zip":
      return { text: t.unknown, blocking: false };
    default:
      return null;
  }
}

/** "$29 (about 69 miles)" */
export const travelFeeValue = (feeCents: number, miles: number | null) => (miles === null ? formatMoney(feeCents) : fill(t.value, { fee: formatMoney(feeCents), miles: String(miles) }));
