import { bookingRules } from "@/config/booking";
import { todayInZone } from "./timezone";

/** Human-friendly booking reference: TH-YYYYMMDD-NNNN (date booked, studio time zone). */
export function generateBookingReference(now = new Date()): string {
  const day = todayInZone(bookingRules.timeZone, now).replaceAll("-", "");
  const n = new Uint16Array(1);
  globalThis.crypto.getRandomValues(n);
  return `TH-${day}-${String(1000 + (n[0] % 9000))}`;
}
