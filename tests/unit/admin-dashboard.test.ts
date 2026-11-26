import { describe, expect, it } from "vitest";
import { bucketLabel, bucketStarts, monthOf, parsePeriod, periodLabel, shiftMonth, unitFor, weekStartKey } from "@/lib/admin/dashboard-period";
import { summarizePeriod, type DashboardBookingRow, type DashboardPaymentRow, type DashboardRequestRow } from "@/lib/admin/dashboard-summary";

const tz = "America/New_York";
const row = (r: Partial<DashboardBookingRow>): DashboardBookingRow => ({
  createdAt: new Date("2026-11-13T15:00:00Z"),
  cancelledAt: null,
  status: "confirmed",
  bundleName: "Our Little Story",
  totalCents: 24900,
  utmSource: null,
  utmMedium: null,
  fbclid: null,
  referrer: null,
  depositStatus: null,
  ...r,
});
const request = (r: Partial<DashboardRequestRow>): DashboardRequestRow => ({ createdAt: new Date("2026-11-10T15:00:00Z"), mobile: "+13055550142", email: "sofia@example.com", status: "new", ...r });
const pay = (at: string, cents: number, kind: DashboardPaymentRow["kind"]): DashboardPaymentRow => ({ paidAt: new Date(at), cents, kind });

describe("dashboard dates (owner, Nov 25: this month by default, other months or any dates)", () => {
  it("opens on the month of today", () => {
    expect(parsePeriod(null, null, "2026-11-25")).toEqual({ period: { from: "2026-11-01", to: "2026-11-30" } });
    expect(monthOf("2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("steps a month back or forward across the year", () => {
    expect(shiftMonth("2026-01-01", -1)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(shiftMonth("2026-12-01", 1)).toEqual({ from: "2027-01-01", to: "2027-01-31" });
  });

  it("takes any from–to dates, and says what's wrong with a bad pair", () => {
    expect(parsePeriod("2026-10-03", "2026-11-20", "2026-11-25")).toEqual({ period: { from: "2026-10-03", to: "2026-11-20" } });
    expect(parsePeriod("2026-11-20", "2026-11-03", "2026-11-25")).toEqual({ error: "The end date is before the start date." });
    expect(parsePeriod("2026-11-03", null, "2026-11-25")).toEqual({ error: "Pick a start and an end date." });
    expect(parsePeriod("2026-02-30", "2026-03-01", "2026-11-25")).toEqual({ error: "Pick a start and an end date." });
    expect(parsePeriod("2023-01-01", "2026-11-25", "2026-11-25")).toEqual({ error: "Pick up to 2 years at a time." });
  });

  it("shows days up to a month, weeks up to half a year, then months", () => {
    expect(unitFor({ from: "2026-11-01", to: "2026-11-30" })).toBe("day");
    expect(unitFor({ from: "2026-12-01", to: "2026-12-31" })).toBe("day");
    expect(unitFor({ from: "2026-09-01", to: "2026-11-30" })).toBe("week");
    expect(unitFor({ from: "2026-01-01", to: "2026-12-31" })).toBe("month");
    expect(bucketStarts({ from: "2026-11-01", to: "2026-11-30" }, "day")).toHaveLength(30);
    // weeks start on Monday; the first one can start before the dates
    expect(weekStartKey("2026-11-01")).toBe("2026-10-26");
    expect(bucketStarts({ from: "2026-11-01", to: "2026-11-30" }, "week")).toEqual(["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(bucketStarts({ from: "2026-11-15", to: "2027-02-03" }, "month")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01"]);
  });

  it("names the dates the way the owner reads them", () => {
    expect(periodLabel({ from: "2026-11-01", to: "2026-11-30" })).toBe("November 2026");
    expect(periodLabel({ from: "2026-11-03", to: "2026-11-20" })).toBe("Nov 3 – 20, 2026");
    expect(periodLabel({ from: "2026-10-03", to: "2026-11-20" })).toBe("Oct 3 – Nov 20, 2026");
    expect(periodLabel({ from: "2026-12-15", to: "2027-01-10" })).toBe("Dec 15, 2026 – Jan 10, 2027");
    expect(periodLabel({ from: "2026-11-05", to: "2026-11-05" })).toBe("Nov 5, 2026");
    expect(bucketLabel("2026-11-14", "day")).toBe("11/14");
    expect(bucketLabel("2026-11-01", "month", true)).toBe("Nov '26");
    expect(bucketLabel("2027-01-01", "month")).toBe("Jan '27");
    expect(bucketLabel("2026-12-01", "month")).toBe("Dec");
  });
});

describe("summarizePeriod", () => {
  const november = { from: "2026-11-01", to: "2026-11-30" };
  const s = summarizePeriod(
    {
      bookings: [
        // booked Nov 13 from a Meta ad
        row({ utmSource: "facebook", utmMedium: "paid_social" }),
        // booked late Oct 31 in Miami (already Nov 1 in UTC): October's, not November's
        row({ createdAt: new Date("2026-11-01T02:30:00Z"), bundleName: "Little Moments", totalCents: 14900 }),
        // booked Nov 30 at 11 pm in Miami (Dec 1 in UTC): November's
        row({ createdAt: new Date("2026-12-01T04:00:00Z"), status: "rescheduled", bundleName: "Little Moments", totalCents: 17900 }),
        // cancelled in November (booked earlier): a cancellation, not a November booking
        row({ createdAt: new Date("2026-10-01T15:00:00Z"), status: "cancelled", cancelledAt: new Date("2026-11-14T15:00:00Z") }),
        // a time hold whose deposit was never paid: counted apart from real cancellations
        row({ status: "cancelled", cancelledAt: new Date("2026-11-13T16:00:00Z"), depositStatus: "expired" }),
        // still waiting for its deposit: not booked yet
        row({ status: "pending" }),
      ],
      requests: [
        // Sofia sent two requests: one lead, booked
        request({ status: "declined" }),
        request({ createdAt: new Date("2026-11-12T15:00:00Z"), mobile: "(305) 555-0142", status: "booked" }),
        // Ana is waiting for the owner
        request({ createdAt: new Date("2026-11-20T15:00:00Z"), mobile: "+17865550100", email: "ana@example.com" }),
        // Lucia's deposit link is out
        request({ createdAt: new Date("2026-11-21T15:00:00Z"), mobile: "+17865550199", email: "lucia@example.com", status: "confirmed" }),
        // October's request
        request({ createdAt: new Date("2026-10-30T15:00:00Z"), mobile: "+17865550111", email: "old@example.com" }),
      ],
      payments: [
        pay("2026-11-12T16:00:00Z", 5000, "deposit"),
        pay("2026-11-14T20:00:00Z", 19900, "session"),
        pay("2026-11-20T20:00:00Z", 4500, "extras"),
        // paid Oct 31 at 9 pm in Miami: October's
        pay("2026-11-01T01:00:00Z", 5000, "deposit"),
      ],
    },
    november,
    "day",
    tz,
  );

  it("adds up what was paid, by kind", () => {
    expect(s.totals.paidCents).toBe(29400);
    expect(s.totals.paid).toEqual({ depositCents: 5000, sessionCents: 19900, extrasCents: 4500, extrasOrders: 1 });
  });

  it("counts sessions booked in the month that are still on, by Miami date", () => {
    expect(s.totals.bookings).toBe(2);
    expect(s.totals.bookedCents).toBe(24900 + 17900);
  });

  it("counts each family that sent a request once: booked, waiting for the owner", () => {
    expect(s.totals.leads).toBe(3);
    expect(s.totals.leadsBooked).toBe(1);
    expect(s.totals.leadsWaiting).toBe(1);
  });

  it("puts each number on its day", () => {
    expect(s.buckets).toHaveLength(30);
    const day = (key: string) => s.buckets.find((b) => b.start === key)!;
    expect(day("2026-11-10")).toEqual({ start: "2026-11-10", paidCents: 0, bookedCents: 0, bookings: 0, leads: 1 });
    expect(day("2026-11-12")).toEqual({ start: "2026-11-12", paidCents: 5000, bookedCents: 0, bookings: 0, leads: 0 });
    expect(day("2026-11-13")).toEqual({ start: "2026-11-13", paidCents: 0, bookedCents: 24900, bookings: 1, leads: 0 });
    expect(day("2026-11-30")).toMatchObject({ bookings: 1, bookedCents: 17900 });
    expect(s.buckets.reduce((n, b) => n + b.paidCents, 0)).toBe(s.totals.paidCents);
  });

  it("splits the same bookings by bundle and by source", () => {
    expect(s.bundles).toEqual([
      { label: "Our Little Story", bookings: 1, revenueCents: 24900 },
      { label: "Little Moments", bookings: 1, revenueCents: 17900 },
    ]);
    expect(s.sources.map((x) => x.label)).toEqual(["Meta ads", "Direct"]);
  });

  it("counts cancellations apart from unpaid deposit holds", () => {
    expect(s.cancelled).toBe(1);
    expect(s.depositNotPaid).toBe(1);
  });

  it("groups a longer range by week", () => {
    const fall = summarizePeriod({ bookings: [row({})], requests: [], payments: [pay("2026-11-14T20:00:00Z", 19900, "session")] }, { from: "2026-09-01", to: "2026-11-30" }, "week", tz);
    expect(fall.buckets[0].start).toBe("2026-08-31");
    expect(fall.buckets.find((b) => b.start === "2026-11-09")).toEqual({ start: "2026-11-09", paidCents: 19900, bookedCents: 24900, bookings: 1, leads: 0 });
  });
});
