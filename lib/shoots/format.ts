import { bookingRules } from "@/config/booking";
import { addDaysKey, todayInZone } from "@/lib/booking/timezone";

/** Owner-area wording for Shoots (English, like the rest of /admin). Pure: used in the browser and in tests. */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Today in Miami ("YYYY-MM-DD"), whatever the phone's own time zone. */
export const todayMiami = (now = new Date()) => todayInZone(bookingRules.timeZone, now);
export const tomorrowMiami = (now = new Date()) => addDaysKey(todayMiami(now), 1);

/** "2026-11-16" → { weekday: "Monday", month: "November", day: 16 } (no time zone shift). */
export function dayParts(date: string): { weekday: string; month: string; day: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { weekday: DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()], month: MONTHS[m - 1], day: d };
}

/** "Monday, November 16" */
export function dayLabel(date: string): string {
  const p = dayParts(date);
  return `${p.weekday}, ${p.month} ${p.day}`;
}

/** "09:00" → "9:00", "17:31" → "5:31" (the day sheet is read in context, like the template). */
export function clock(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}`;
}

/** "1 shoot" / "2 shoots" */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "6 inspo · 3 BTS ideas" pieces for a shoot, or "No inspo yet". */
export function inspoCounts(inspo: number, bts: number): { inspo: string | null; bts: string | null } {
  return { inspo: inspo ? plural(inspo, "inspo", "inspo") : null, bts: bts ? plural(bts, "BTS idea", "BTS ideas") : null };
}
