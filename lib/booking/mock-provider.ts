import { getBundle } from "@/config/bundles";
import { availabilityForRange } from "./availability";
import { defaultAvailabilityRules } from "@/lib/availability/defaults";
import type { AvailabilityRules } from "@/lib/availability/types";
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
 * MOCK provider. Nothing here touches a real calendar.
 * Uses the owner's availability rules, plus simulated bookings
 * (some days "fully booked", some times taken).
 */
export class MockBookingProvider implements BookingProvider {
  readonly name = "mock";

  /** Where the owner's availability rules come from (browser storage in the prototype, Neon on the server). */
  constructor(private readonly rules: () => Promise<AvailabilityRules> = async () => defaultAvailabilityRules()) {}

  async getAvailability(query: AvailabilityQuery): Promise<DayAvailability[]> {
    await wait(250);
    const minutes = getBundle(query.bundleId)?.durationMinutes ?? 60;
    const rules = await this.rules();
    // The owner's real rules, plus simulated existing bookings so the preview looks lived-in.
    return availabilityForRange(query.from, query.to, minutes, [], rules).map((day) =>
      seeded(`full-${day.date}`) < 0.16 ? { date: day.date, slots: [] } : { date: day.date, slots: day.slots.filter((t) => seeded(`${day.date}-${t.start}`) > 0.25) },
    );
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
