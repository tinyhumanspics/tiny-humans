import { describe, expect, it } from "vitest";
import { DASHBOARD_WEEKS, summarizeBookings, weekStartKey, windowStartKey, type DashboardBookingRow } from "@/lib/admin/dashboard-summary";

const tz = "America/New_York";
const row = (r: Partial<DashboardBookingRow>): DashboardBookingRow => ({
  createdAt: new Date("2026-10-13T15:00:00Z"),
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

describe("dashboard weeks", () => {
  it("start on Monday (studio dates)", () => {
    expect(weekStartKey("2026-10-15")).toBe("2026-10-12"); // Thursday
    expect(weekStartKey("2026-10-12")).toBe("2026-10-12"); // Monday
    expect(weekStartKey("2026-10-18")).toBe("2026-10-12"); // Sunday
  });

  it("cover this week and the 11 before it", () => {
    expect(windowStartKey("2026-10-15")).toBe("2026-07-27");
    expect(DASHBOARD_WEEKS).toBe(12);
  });
});

describe("summarizeBookings", () => {
  const rows = [
    // booked Tuesday Oct 13 from a Meta ad
    row({ utmSource: "facebook", utmMedium: "paid_social" }),
    // booked late Sunday Oct 11 in Miami (already Monday in UTC): belongs to the week of Oct 5
    row({ createdAt: new Date("2026-10-12T03:30:00Z"), status: "rescheduled", bundleName: "Little Moments", totalCents: 14900 }),
    // cancelled by the family this week (booked earlier): a cancellation, not a booking in the weekly bars
    row({ createdAt: new Date("2026-07-01T15:00:00Z"), status: "cancelled", cancelledAt: new Date("2026-10-14T15:00:00Z") }),
    // a time hold whose deposit was never paid: counted apart from real cancellations
    row({ status: "cancelled", cancelledAt: new Date("2026-10-13T16:00:00Z"), depositStatus: "expired" }),
    // still waiting for its deposit: not a booking yet
    row({ status: "pending" }),
    // booked before the 12 weeks
    row({ createdAt: new Date("2026-06-01T15:00:00Z") }),
  ];
  const s = summarizeBookings(rows, "2026-10-15", tz);

  it("buckets bookings that are still on by the week they were made", () => {
    expect(s.weeks).toHaveLength(12);
    expect(s.weeks.at(-1)).toEqual({ weekStart: "2026-10-12", bookings: 1, revenueCents: 24900 });
    expect(s.weeks.at(-2)).toEqual({ weekStart: "2026-10-05", bookings: 1, revenueCents: 14900 });
    expect(s.weeks.slice(0, -2).every((w) => w.bookings === 0 && w.revenueCents === 0)).toBe(true);
  });

  it("splits the same bookings by bundle and by source", () => {
    expect(s.bundles).toEqual([
      { label: "Our Little Story", bookings: 1, revenueCents: 24900 },
      { label: "Little Moments", bookings: 1, revenueCents: 14900 },
    ]);
    expect(s.sources.map((x) => x.label)).toEqual(["Meta ads", "Direct"]);
  });

  it("counts cancellations apart from unpaid deposit holds", () => {
    expect(s.cancelled).toBe(1);
    expect(s.depositNotPaid).toBe(1);
  });
});
