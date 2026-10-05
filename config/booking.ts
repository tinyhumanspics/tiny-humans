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
 * Booking rules: one place to edit scheduling. Used by the mock provider
 * (prototype / BOOKING_PROVIDER=mock) and the Outlook provider (real
 * calendar). Times are local to `timeZone`.
 */
export const bookingRules = {
  /** The studio's time zone (IANA name). */
  timeZone: "America/New_York",
  /** The same zone as Microsoft Graph names it (Windows time zone ID). */
  graphTimeZone: "Eastern Standard Time",
  /** Opening hours per weekday (0 = Sunday). null = closed. Sessions must end by `close`. */
  businessHours: {
    0: null,
    1: { open: "09:00", close: "18:00" },
    2: { open: "09:00", close: "18:00" },
    3: { open: "09:00", close: "18:00" },
    4: { open: "09:00", close: "18:00" },
    5: { open: "09:00", close: "18:00" },
    6: { open: "09:00", close: "18:00" },
  } as Record<number, { open: string; close: string } | null>,
  /** Families can't book closer than this to the session start. */
  minimumLeadTimeHours: 24,
  /** How far ahead families can book. */
  bookingWindowDays: 90,
  /**
   * Start times offered for each session length (current prototype behavior).
   * A length with no list gets start times every `slotIntervalMinutes`
   * within business hours instead.
   */
  startTimesByDuration: [
    { maxMinutes: 45, times: ["09:00", "10:15", "11:30", "13:00", "14:15", "15:30", "16:45"] },
    { maxMinutes: 90, times: ["09:00", "11:00", "13:30", "15:30"] },
    { maxMinutes: 120, times: ["09:00", "11:30", "14:00"] },
  ],
  slotIntervalMinutes: 15,
  /** Travel/setup time kept free around every home session (real calendar only). */
  sessionBuffers: { beforeMinutes: 45, afterMinutes: 45 },
};

/** Calendar UI + mock settings derived from the rules above. */
export const bookingSettings = {
  /** How far ahead families can book. */
  maxDaysAhead: bookingRules.bookingWindowDays,
  /** Earliest bookable day, counted from today. */
  minDaysAhead: Math.max(1, Math.ceil(bookingRules.minimumLeadTimeHours / 24)),
  timeZone: bookingRules.timeZone,
};

/** Start times for a session of the given length, before calendar conflicts. */
export function candidateStartTimes(durationMinutes: number, weekday: number): string[] {
  const hours = bookingRules.businessHours[weekday];
  if (!hours) return [];
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const open = toMin(hours.open);
  const close = toMin(hours.close);
  const list = bookingRules.startTimesByDuration.find((r) => durationMinutes <= r.maxMinutes)?.times;
  const starts = list
    ? list.map(toMin)
    : Array.from({ length: Math.floor((close - open) / bookingRules.slotIntervalMinutes) + 1 }, (_, i) => open + i * bookingRules.slotIntervalMinutes);
  return starts.filter((m) => m >= open && m + durationMinutes <= close).map(fmt);
}

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
