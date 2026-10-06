import { getBundle } from "@/config/bundles";
import { availabilityForRange } from "./availability";
import { defaultAvailabilityRules } from "@/lib/availability/defaults";
import type { AvailabilityRules } from "@/lib/availability/types";
import { BookingError, friendly } from "./errors";
import { generateBookingReference } from "./reference";
import type { Lead } from "@/lib/leads/types";
import type {
  CancelOptions,
  CancellationSummary,
  ManagedBooking,
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

  /** Mock bookings: this browser's storage in the prototype, memory on a server. Nothing real is created. */
  private store = mockStore();

  async createBooking(request: BookingRequest): Promise<BookingResult> {
    await wait(700);
    const token = randomToken();
    const result: BookingResult = {
      id: generateBookingReference(),
      status: "mock",
      request,
      createdAt: new Date().toISOString(),
      preview: { cancelToken: token },
    };
    const all = this.store.read();
    all.push({ result, token, status: "confirmed", cancellation: null, history: [] });
    this.store.write(all);
    return result;
  }

  async getCancellation(token: string): Promise<CancellationSummary> {
    await wait(200);
    const rec = this.store.read().find((r) => r.token === token);
    if (!rec) throw new BookingError("not_found", "This cancellation link isn't valid. Please reply to your confirmation email and we'll help.");
    return mockSummary(rec);
  }

  async cancelWithToken(token: string, reason: string): Promise<CancellationSummary> {
    const rec = this.store.read().find((r) => r.token === token);
    if (!rec) throw new BookingError("not_found", "This cancellation link isn't valid. Please reply to your confirmation email and we'll help.");
    await this.cancelBooking(rec.result.id, { reason, by: "customer" });
    return this.getCancellation(token);
  }

  async cancelBooking(reference: string, opts?: CancelOptions): Promise<void> {
    await wait(400);
    const all = this.store.read();
    const rec = all.find((r) => r.result.id === reference);
    if (!rec) throw new BookingError("not_found", "We couldn't find that booking.");
    if (rec.status === "cancelled") return;
    rec.status = "cancelled";
    rec.cancellation = { reason: opts?.reason ?? "Cancelled", at: new Date().toISOString(), by: opts?.by ?? "admin" };
    this.store.write(all);
  }

  private async rulesNow() {
    return this.rules();
  }

  private recordFor(token: string): MockRecord {
    const rec = this.store.read().find((r) => r.token === token);
    if (!rec) throw new BookingError("not_found", "This link isn't valid anymore. Please use the link in your most recent Tiny Humans email, or reply to it and we'll help.");
    return rec;
  }

  async getManagedBooking(token: string): Promise<ManagedBooking> {
    await wait(200);
    return mockManaged(this.recordFor(token), (await this.rulesNow()).limits.rescheduleNoticeHours);
  }

  async getRescheduleAvailability(token: string, from: string, to: string): Promise<DayAvailability[]> {
    const rec = this.recordFor(token);
    if (!mockManaged(rec, (await this.rulesNow()).limits.rescheduleNoticeHours).canReschedule) return [];
    return this.getAvailability({ bundleId: rec.result.request.bundleId, from, to });
  }

  async rescheduleWithToken(token: string, slot: { date: string; start: string }): Promise<ManagedBooking> {
    const rec = this.recordFor(token);
    const hours = (await this.rulesNow()).limits.rescheduleNoticeHours;
    const m = mockManaged(rec, hours);
    if (m.status === "cancelled") throw new BookingError("invalid_request", "This booking has already been cancelled.");
    if (!m.canReschedule) throw new BookingError("reschedule_closed", `This session is less than ${hours} hours away, so online rescheduling is no longer available. Please contact Tiny Humans if you need help with your appointment.`);
    await this.moveBooking(rec.result.id, slot, "customer");
    return this.getManagedBooking(token);
  }

  async rescheduleBooking(reference: string, slot: Pick<TimeSlot, "date" | "start">): Promise<BookingResult> {
    return this.moveBooking(reference, slot, "admin");
  }

  private async moveBooking(reference: string, slot: Pick<TimeSlot, "date" | "start">, by: "customer" | "admin"): Promise<BookingResult> {
    await wait(300);
    const all = this.store.read();
    const rec = all.find((r) => r.result.id === reference);
    if (!rec || rec.status === "cancelled") throw new BookingError("not_found", "We couldn't find that booking.");
    const minutes = getBundle(rec.result.request.bundleId)?.durationMinutes ?? 60;
    const [day] = await this.getAvailability({ bundleId: rec.result.request.bundleId, from: slot.date, to: slot.date });
    if (!day?.slots.some((s) => s.start === slot.start)) throw new BookingError("slot_unavailable", friendly.rescheduleTaken);
    const old = rec.result.request.slot;
    const end = addMinutes(slot.start, minutes);
    rec.history = [...(rec.history ?? []), { oldDate: old.date, oldStart: old.start, oldEnd: old.end, newDate: slot.date, newStart: slot.start, newEnd: end, by, at: new Date().toISOString() }];
    rec.result = { ...rec.result, request: { ...rec.result.request, slot: { id: `${slot.date}T${slot.start}`, date: slot.date, start: slot.start, end, label: formatTimeLabel(slot.start) } } };
    rec.status = "rescheduled";
    this.store.write(all);
    return rec.result;
  }

  /** Prototype /admin > Leads: permanent delete. */
  deleteLead(reference: string): void {
    this.store.write(this.store.read().filter((r) => r.result.id !== reference));
  }

  /** Prototype /admin > Leads. */
  listLeads(): Lead[] {
    return this.store.read().map(mockLead).reverse();
  }
}

/* ---------------- mock storage ---------------- */

export interface MockRecord {
  result: BookingResult;
  token: string;
  status: "confirmed" | "rescheduled" | "cancelled";
  cancellation: { reason: string; at: string; by: "customer" | "admin" } | null;
  history?: { oldDate: string; oldStart: string; oldEnd: string; newDate: string; newStart: string; newEnd: string; by: "customer" | "admin"; at: string }[];
}

function mockManaged(rec: MockRecord, noticeHours: number): ManagedBooking {
  const r = rec.result.request;
  const startMs = new Date(`${r.slot.date}T${r.slot.start}:00`).getTime();
  const status = rec.status === "cancelled" ? "cancelled" : startMs <= Date.now() ? "past" : "active";
  return {
    reference: rec.result.id,
    bundleId: r.bundleId,
    bundleName: getBundle(r.bundleId)?.name ?? r.bundleId,
    date: r.slot.date,
    start: r.slot.start,
    end: r.slot.end,
    location: `${r.address.street}, ${r.address.city}, FL ${r.address.zip}`,
    parentFirstName: r.contact.parentName.split(" ")[0],
    status,
    canReschedule: status === "active" && (startMs - Date.now()) / 3_600_000 >= noticeHours,
    rescheduleNoticeHours: noticeHours,
  };
}

const STORAGE_KEY = "tinyhumans:prototype-bookings";
let memory: MockRecord[] = [];

function mockStore() {
  const browser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  return {
    read(): MockRecord[] {
      if (!browser) return memory;
      try {
        return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as MockRecord[];
      } catch {
        return [];
      }
    },
    write(records: MockRecord[]) {
      if (!browser) {
        memory = records;
        return;
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-50)));
      } catch {
        /* storage full: preview only */
      }
    },
  };
}

function randomToken(): string {
  const b = new Uint8Array(32);
  globalThis.crypto.getRandomValues(b);
  let s = "";
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function mockSummary(rec: MockRecord): CancellationSummary {
  const r = rec.result.request;
  const past = new Date(`${r.slot.date}T${r.slot.start}:00`).getTime() <= Date.now();
  return {
    reference: rec.result.id,
    bundleName: getBundle(r.bundleId)?.name ?? r.bundleId,
    date: r.slot.date,
    start: r.slot.start,
    end: r.slot.end,
    parentFirstName: r.contact.parentName.split(" ")[0],
    status: rec.status === "cancelled" ? "cancelled" : past ? "past" : "active",
  };
}

function mockLead(rec: MockRecord): Lead {
  const r = rec.result.request;
  const b = getBundle(r.bundleId);
  const sent = { sent: false, at: null, error: "prototype (nothing sent)" };
  return {
    reference: rec.result.id,
    status: rec.status,
    parentName: r.contact.parentName,
    email: r.contact.email,
    phone: r.contact.phone,
    babyName: r.contact.babyName ?? null,
    babyAge: r.contact.babyAge,
    bundleId: r.bundleId,
    bundleName: b?.name ?? r.bundleId,
    packagePrice: b?.price ?? 0,
    sessionDate: r.slot.date,
    start: r.slot.start,
    end: r.slot.end,
    locationType: "client_home",
    address: `${r.address.street}, ${r.address.city}, FL ${r.address.zip}`,
    notes: r.contact.notes ?? null,
    inspirationPhotoId: r.inspirationPhotoId ?? null,
    calendarLinked: false,
    confirmationEmail: sent,
    internalNotification: sent,
    history: (rec.history ?? []).map((h) => ({ oldDate: h.oldDate, oldStart: h.oldStart, newDate: h.newDate, newStart: h.newStart, newEnd: h.newEnd, by: h.by, at: h.at })),
    cancellation: rec.cancellation ? { ...rec.cancellation, email: sent, internal: sent } : null,
    createdAt: rec.result.createdAt,
  };
}
