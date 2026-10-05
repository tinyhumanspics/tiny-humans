import { getBundle } from "@/config/bundles";
import { bookingSettings, candidateStartTimes } from "@/config/booking";
import { BookingError, friendly } from "./errors";
import { generateBookingReference } from "./reference";
import type {
  AvailabilityQuery,
  BookingProvider,
  BookingRequest,
  BookingResult,
  DayAvailability,
  TimeSlot,
} from "./types";
import { addDays, addMinutes, formatTimeLabel, fromDateKey, startOfDay, toDateKey } from "./dates";

/** Deterministic pseudo-random number in [0,1) for a string seed. */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * MOCK availability. Nothing here touches a real calendar.
 * - Closed on Sundays
 * - Some days are "fully booked"
 * - Longer bundles get fewer, longer slots
 */
export class MockBookingProvider implements BookingProvider {
  readonly name = "mock";

  async getAvailability(query: AvailabilityQuery): Promise<DayAvailability[]> {
    await wait(250);
    const bundle = getBundle(query.bundleId);
    const minutes = bundle?.durationMinutes ?? 60;
    const today = startOfDay(new Date());
    const earliest = addDays(today, bookingSettings.minDaysAhead);
    const latest = addDays(today, bookingSettings.maxDaysAhead);

    const days: DayAvailability[] = [];
    for (let d = fromDateKey(query.from); d <= fromDateKey(query.to); d = addDays(d, 1)) {
      const key = toDateKey(d);
      let slots: TimeSlot[] = [];
      const open = d >= earliest && d <= latest && d.getDay() !== 0;
      const fullyBooked = seeded(`full-${key}`) < 0.16;
      if (open && !fullyBooked) {
        slots = candidateStartTimes(minutes, d.getDay())
          .filter((t) => seeded(`${key}-${t}`) > 0.35)
          .map((start) => ({
            id: `${key}T${start}`,
            date: key,
            start,
            end: addMinutes(start, minutes),
            label: formatTimeLabel(start),
          }));
      }
      days.push({ date: key, slots });
    }
    return days;
  }

  /** Bookings made in this session (memory only; nothing leaves the browser/server process). */
  private made = new Map<string, BookingResult>();

  async createBooking(request: BookingRequest): Promise<BookingResult> {
    await wait(700);
    const result: BookingResult = {
      id: generateBookingReference(),
      status: "mock",
      request,
      createdAt: new Date().toISOString(),
    };
    this.made.set(result.id, result);
    return result;
  }

  async cancelBooking(reference: string): Promise<void> {
    await wait(200);
    if (!this.made.delete(reference)) throw new BookingError("not_found", "We couldn't find that booking.");
  }

  async rescheduleBooking(reference: string, slot: Pick<TimeSlot, "date" | "start">): Promise<BookingResult> {
    await wait(300);
    const existing = this.made.get(reference);
    if (!existing) throw new BookingError("not_found", "We couldn't find that booking.");
    const minutes = getBundle(existing.request.bundleId)?.durationMinutes ?? 60;
    const [day] = await this.getAvailability({ bundleId: existing.request.bundleId, from: slot.date, to: slot.date });
    if (!day?.slots.some((s) => s.start === slot.start)) throw new BookingError("slot_unavailable", friendly.slotTaken);
    const moved: BookingResult = {
      ...existing,
      request: { ...existing.request, slot: { id: `${slot.date}T${slot.start}`, date: slot.date, start: slot.start, end: addMinutes(slot.start, minutes), label: formatTimeLabel(slot.start) } },
    };
    this.made.set(reference, moved);
    return moved;
  }
}
