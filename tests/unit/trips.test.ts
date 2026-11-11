import { describe, expect, test } from "vitest";
import { DEFAULT_TRIP_SETTINGS, tripLimit, withinTripLimit, zipOfAddress, type PlacedSession } from "@/lib/booking/trips";

// fake road miles between ZIP codes: Miami Beach 33139, Weston 33326, Boca 33432, Orlando 32801/32819, Kissimmee 34741, Tampa 33602
const AT: Record<string, number> = { "33139": 0, "33326": 30, "33432": 50, "32801": 235, "32819": 240, "34741": 230, "33602": 280 };
const distance = (a: string, b: string) => (a in AT && b in AT ? Math.abs(AT[a] - AT[b]) : null);
const miami = (date: string, start = "10:00"): PlacedSession => ({ date, start, zip: "33139", miles: 2 });
const orlando = (date: string, start = "10:00"): PlacedSession => ({ date, start, zip: "32801", miles: 235 });
const s = DEFAULT_TRIP_SETTINGS;
const visitor = (zip: string) => ({ zip, miles: AT[zip] ?? null });

describe("trip days (owner, Nov 10: Orlando takes the day; 60 miles; same trip within 30; next day from 12 PM)", () => {
  test("an empty day is open for everyone", () => {
    expect(tripLimit("2026-12-02", visitor("32801"), [], s, distance)).toEqual({ closed: null, notBefore: null });
    expect(tripLimit("2026-12-02", visitor("33139"), [], s, distance)).toEqual({ closed: null, notBefore: null });
  });

  test("an Orlando session: other Orlando-area families can share the day, Miami families can't", () => {
    const day = [orlando("2026-12-02")];
    expect(tripLimit("2026-12-02", visitor("32819"), day, s, distance).closed).toBeNull(); // 5 miles away
    expect(tripLimit("2026-12-02", visitor("34741"), day, s, distance).closed).toBeNull(); // Kissimmee, 5 miles
    expect(tripLimit("2026-12-02", visitor("33139"), day, s, distance).closed).toBe("trip_elsewhere");
    expect(tripLimit("2026-12-02", visitor("33602"), day, s, distance).closed).toBe("trip_elsewhere"); // Tampa is far from Orlando too
  });

  test("a day with Miami sessions is closed for a far family, open for nearby ones (up to 60 miles = normal)", () => {
    const day = [miami("2026-12-02")];
    expect(tripLimit("2026-12-02", visitor("32801"), day, s, distance).closed).toBe("local_day");
    expect(tripLimit("2026-12-02", visitor("33326"), day, s, distance).closed).toBeNull();
    expect(tripLimit("2026-12-02", visitor("33432"), day, s, distance).closed).toBeNull();
  });

  test("the morning after a trip day stays free until 12 PM, for everyone", () => {
    const sessions = [orlando("2026-12-02")];
    const limit = tripLimit("2026-12-03", visitor("33139"), sessions, s, distance);
    expect(limit).toEqual({ closed: null, notBefore: "12:00" });
    expect(withinTripLimit([{ start: "09:00" }, { start: "11:30" }, { start: "12:00" }, { start: "15:00" }], limit).map((x) => x.start)).toEqual(["12:00", "15:00"]);
  });

  test("a far family can't take a day whose next morning is already booked", () => {
    expect(tripLimit("2026-12-02", visitor("32801"), [miami("2026-12-03", "09:30")], s, distance).closed).toBe("next_morning_busy");
    expect(tripLimit("2026-12-02", visitor("32801"), [miami("2026-12-03", "13:00")], s, distance).closed).toBeNull();
  });

  test("unknown distance counts as close to home; switched off = no limits", () => {
    expect(tripLimit("2026-12-02", { zip: null, miles: null }, [miami("2026-12-02")], s, distance).closed).toBeNull();
    expect(tripLimit("2026-12-02", visitor("33139"), [orlando("2026-12-02")], { ...s, enabled: false }, distance)).toEqual({ closed: null, notBefore: null });
  });

  test("the ZIP code of a saved address", () => {
    expect(zipOfAddress("1500 Bay Rd, Unit 1204, Miami Beach, FL 33139")).toBe("33139");
    expect(zipOfAddress("12345 SW 8th St, Miami, FL 33175-1234")).toBe("33175");
    expect(zipOfAddress("no zip here")).toBeNull();
  });
});
