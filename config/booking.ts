/**
 * Booking settings. Tiny Humans brings the studio to every family's home,
 * so there is no location choice: the family's address is collected in
 * the details step.
 */
export const homeSession = {
  /** Shown above the address fields in the booking form. */
  addressHelp: "We bring the lights, backdrops and props to you, so your little one can stay comfy at home. Just leave us a little space near a window if you can.",
};

export const babyAgeOptions = [
  "Newborn (0–2 weeks)",
  "2–6 weeks",
  "6 weeks – 3 months",
  "3–6 months",
  "6–12 months",
  "1 year or older",
  "Not born yet",
] as const;

/**
 * Fixed booking settings. The *changeable* rules (weekly hours, notice,
 * booking window, buffer, special dates, time blocks) are managed by the
 * owner in /admin > Availability and stored in Neon; the defaults below are
 * used until the owner saves their own (and in the prototype).
 */
export const bookingRules = {
  /** The studio's time zone (IANA name). */
  timeZone: "America/New_York",
  /** The same zone as Microsoft Graph names it (Windows time zone ID). */
  graphTimeZone: "Eastern Standard Time",
  /** Start times are offered every N minutes from opening time. */
  slotIntervalMinutes: 60,
  /** Limits for the owner's settings. */
  limits: { maxNoticeDays: 60, maxWindowDays: 365, maxBufferMinutes: 240 },
  /** Defaults (match the original prototype behaviour). */
  defaults: {
    weekly: [
      { weekday: 0, isOpen: false, start: "09:00", end: "18:00" },
      { weekday: 1, isOpen: true, start: "09:00", end: "18:00" },
      { weekday: 2, isOpen: true, start: "09:00", end: "18:00" },
      { weekday: 3, isOpen: true, start: "09:00", end: "18:00" },
      { weekday: 4, isOpen: true, start: "09:00", end: "18:00" },
      { weekday: 5, isOpen: true, start: "09:00", end: "18:00" },
      { weekday: 6, isOpen: true, start: "09:00", end: "18:00" },
    ],
    minimumNoticeDays: 1,
    bookingWindowDays: 90,
    /** Kept free before and after every session (travel/setup). */
    bufferMinutes: 45,
  },
};

/** Calendar UI settings. */
export const bookingSettings = {
  /** How far the calendar lets families page ahead (days without times show as faded). */
  maxDaysAhead: bookingRules.limits.maxWindowDays,
  /** The calendar opens on the current month. */
  minDaysAhead: 0,
  timeZone: bookingRules.timeZone,
};

/** The bundle is chosen on the bundles page, so booking starts at the calendar. */
export const bookingSteps = [
  { id: "date", label: "Date" },
  { id: "time", label: "Time" },
  { id: "details", label: "Details" },
  { id: "review", label: "Review" },
] as const;

export type BookingStepId = (typeof bookingSteps)[number]["id"];

/** Step positions by name, so the flow can change without renumbering. */
export const STEP = { date: 0, time: 1, details: 2, review: 3 } as const;

/** Link to the booking calendar for a bundle (keeps the inspiration photo). */
export function scheduleHref(bundleId: string, inspirationId?: string | null): string {
  const q = new URLSearchParams({ bundle: bundleId });
  if (inspirationId) q.set("inspiration", inspirationId);
  return `/book/schedule?${q.toString()}`;
}

/** Link back to the bundles page (keeps the inspiration photo). */
export function bundlesHref(inspirationId?: string | null): string {
  return inspirationId ? `/book?inspiration=${encodeURIComponent(inspirationId)}` : "/book";
}
