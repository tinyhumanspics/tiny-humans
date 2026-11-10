/**
 * Sunset time for a day sheet, from NOAA's solar calculator formulas
 * (https://gml.noaa.gov/grad/solcalc/calcdetails.html, "NOAA_Solar_Calculations_day.xls"): accurate to about a
 * minute, which is plenty for planning window light. Default place: Miami Beach (the studio's base).
 */
export const MIAMI_BEACH = { lat: 25.7907, lng: -80.13, timeZone: "America/New_York" } as const;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Minutes after 00:00 UTC of `date` when the sun sets, or null when it doesn't (polar day/night). */
export function sunsetUtcMinutes(date: string, lat: number, lng: number): number | null {
  const [y, m, d] = date.split("-").map(Number);
  const midnightUtc = Date.UTC(y, m - 1, d);
  // Julian day at local solar noon (NOAA evaluates the sun's position for the day being calculated)
  const jd = midnightUtc / 86_400_000 + 2_440_587.5 + 0.5 - lng / 360;
  const t = (jd - 2_451_545) / 36_525;

  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const mAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c = Math.sin(rad(mAnom)) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(rad(2 * mAnom)) * (0.019993 - 0.000101 * t) + Math.sin(rad(3 * mAnom)) * 0.000289;
  const appLong = l0 + c - 0.00569 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * t));
  const meanObliq = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliq = meanObliq + 0.00256 * Math.cos(rad(125.04 - 1934.136 * t));
  const decl = deg(Math.asin(Math.sin(rad(obliq)) * Math.sin(rad(appLong))));
  const yy = Math.tan(rad(obliq / 2)) ** 2;
  const eqTime =
    4 *
    deg(
      yy * Math.sin(2 * rad(l0)) -
        2 * e * Math.sin(rad(mAnom)) +
        4 * e * yy * Math.sin(rad(mAnom)) * Math.cos(2 * rad(l0)) -
        0.5 * yy * yy * Math.sin(4 * rad(l0)) -
        1.25 * e * e * Math.sin(2 * rad(mAnom)),
    );
  const cosHa = Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(rad(decl))) - Math.tan(rad(lat)) * Math.tan(rad(decl));
  if (cosHa < -1 || cosHa > 1) return null;
  const solarNoon = 720 - 4 * lng - eqTime;
  return solarNoon + 4 * deg(Math.acos(cosHa));
}

/** Sunset as "HH:MM" (24 h) in the place's time zone, e.g. "17:31". */
export function sunsetOn(date: string, place: { lat: number; lng: number; timeZone: string } = MIAMI_BEACH): string | null {
  const minutes = sunsetUtcMinutes(date, place.lat, place.lng);
  if (minutes === null) return null;
  const [y, m, d] = date.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d) + Math.round(minutes) * 60_000);
  return new Intl.DateTimeFormat("en-GB", { timeZone: place.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}
