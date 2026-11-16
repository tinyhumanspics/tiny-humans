import { describe, expect, test } from "vitest";
import { tripDays } from "@/config/booking";
import { tripLimit, withinTripLimit, type PlacedSession } from "@/lib/booking/trips";

// fake road miles between ZIP codes: Miami Beach 33139, Weston 33326, Boca 33432, Jupiter 33458 (70), Orlando 32801/32819, Kissimmee 34741, Tampa 33602
const AT: Record<string, number> = { "33139": 0, "33326": 30, "33432": 50, "33458": 70, "32801": 235, "32819": 240, "34741": 230, "33602": 280 };
const distance = (a: string, b: string) => (a in AT && b in AT ? Math.abs(AT[a] - AT[b]) : null);
const miami = (date: string, start = "10:00"): PlacedSession => ({ date, start, zip: "33139", miles: 2 });
const orlando = (date: string, start = "10:00"): PlacedSession => ({ date, start, zip: "32801", miles: 235 });
const visitor = (zip: string) => ({ zip, miles: AT[zip] ?? null });
const limit = (date: string, zip: string, sessions: PlacedSession[]) => tripLimit(date, visitor(zip), sessions, distance);

describe("trip days (owner: Orlando takes the day; 70 miles and above from Nov 16; same trip within 30; next day from 12 PM)", () => {
  test("the owner's numbers", () => {
    expect(tripDays).toEqual({ tripMiles: 70, sameTripMiles: 30, nextDayUntil: "12:00" });
  });

  test("an empty day is open for everyone", () => {
    expect(limit("2026-12-02", "32801", [])).toEqual({ closed: null, notBefore: null });
    expect(limit("2026-12-02", "33139", [])).toEqual({ closed: null, notBefore: null });
  });

  test("an Orlando session: other Orlando-area families can share the day, Miami families can't", () => {
    const day = [orlando("2026-12-02")];
    expect(limit("2026-12-02", "32819", day).closed).toBeNull(); // 5 miles away
    expect(limit("2026-12-02", "34741", day).closed).toBeNull(); // Kissimmee, 5 miles
    expect(limit("2026-12-02", "33139", day).closed).toBe("trip_elsewhere");
    expect(limit("2026-12-02", "33602", day).closed).toBe("trip_elsewhere"); // Tampa is far from Orlando too
  });

  test("70 miles is a trip day; under 70 is a normal day", () => {
    const at70: PlacedSession = { date: "2026-12-02", start: "10:00", zip: "33458", miles: 70 };
    const at69: PlacedSession = { ...at70, miles: 69 };
    expect(limit("2026-12-02", "33139", [at70]).closed).toBe("trip_elsewhere");
    expect(limit("2026-12-02", "33139", [at69]).closed).toBeNull();
  });

  test("a day with Miami sessions is closed for a far family, open for nearby ones (under 70 miles = normal)", () => {
    const day = [miami("2026-12-02")];
    expect(limit("2026-12-02", "32801", day).closed).toBe("local_day");
    expect(limit("2026-12-02", "33326", day).closed).toBeNull();
    expect(limit("2026-12-02", "33432", day).closed).toBeNull();
  });

  test("the morning after a trip day stays free until 12 PM, for everyone", () => {
    const after = limit("2026-12-03", "33139", [orlando("2026-12-02")]);
    expect(after).toEqual({ closed: null, notBefore: "12:00" });
    expect(withinTripLimit([{ start: "09:00" }, { start: "11:30" }, { start: "12:00" }, { start: "15:00" }], after).map((x) => x.start)).toEqual(["12:00", "15:00"]);
  });

  test("a far family can't take a day whose next morning is already booked", () => {
    expect(limit("2026-12-02", "32801", [miami("2026-12-03", "09:30")]).closed).toBe("next_morning_busy");
    expect(limit("2026-12-02", "32801", [miami("2026-12-03", "13:00")]).closed).toBeNull();
  });

  test("before the family types a ZIP code they count as close to home: an Orlando day is closed, a Miami day open", () => {
    const unknown = { zip: null, miles: null };
    expect(tripLimit("2026-12-02", unknown, [orlando("2026-12-02")], distance).closed).toBe("trip_elsewhere");
    expect(tripLimit("2026-12-02", unknown, [miami("2026-12-02")], distance).closed).toBeNull();
  });
});
