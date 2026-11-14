import { describe, expect, test } from "vitest";
import { bookingSteps, STEP } from "@/config/booking";
import { fullName, initialState, reducer, splitName, validateContact, type ContactDraft, type State } from "@/features/booking/flow/booking-state";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/** The booking form's steps (owner, Nov 13): first name, email, ZIP → date → time → contact (home) → details → review. */
const contact = (over: Partial<ContactDraft> = {}): ContactDraft => ({ ...initialState.contact, firstName: "Ana", lastName: "Rivera", email: "ana@example.com", phone: "3055550133", street: "1500 Bay Rd", city: "Miami Beach", zip: "33139", ...over });

describe("booking steps", () => {
  test("the order, and a title for each step in both languages", () => {
    expect(bookingSteps.map((s) => s.id)).toEqual(["you", "date", "time", "contact", "details", "review"]);
    expect(STEP).toEqual({ you: 0, date: 1, time: 2, contact: 3, details: 4, review: 5 });
    for (const m of [en, es]) expect(m.bookingFlow.steps.map((s) => s.id)).toEqual(bookingSteps.map((s) => s.id));
  });

  test("step one needs only first name, email and ZIP code", () => {
    const first = { ...initialState.contact, firstName: "Ana", email: "ana@example.com", zip: "33139" };
    expect(validateContact(first, en.bookingFlow.details, "you")).toEqual({});
    expect(Object.keys(validateContact({ ...first, email: "ana@" }, en.bookingFlow.details, "you"))).toEqual(["email"]);
    expect(validateContact({ ...first, zip: "30303" }, en.bookingFlow.details, "you").zip).toBe(en.bookingFlow.details.travel.outsideFlorida);
    expect(validateContact({ ...first, zip: "331" }, en.bookingFlow.details, "you").zip).toBe(en.bookingFlow.details.validation.zip);
  });

  test("the contact step needs last name, phone and the home address", () => {
    expect(validateContact(contact(), en.bookingFlow.details, "contact")).toEqual({});
    expect(Object.keys(validateContact(contact({ lastName: " ", phone: "305", street: "", city: "" }), en.bookingFlow.details, "contact")).sort()).toEqual(["city", "lastName", "phone", "street"]);
  });

  test("first + last make the booking's parent name; a one-line name splits back", () => {
    expect(fullName(contact({ firstName: " Ana ", lastName: " de la Cruz " }))).toBe("Ana de la Cruz");
    expect(fullName(contact({ lastName: "" }))).toBe("Ana");
    expect(splitName("Ana  de la Cruz")).toEqual({ firstName: "Ana", lastName: "de la Cruz" });
    expect(splitName("Ana")).toEqual({ firstName: "Ana", lastName: "" });
  });

  test("a picked time remembers its ZIP code; clearing it sends the family back before the time", () => {
    const slot = { id: "2026-12-01T10:00", date: "2026-12-01", start: "10:00", end: "12:00", label: "10:00 am" };
    let s: State = { ...initialState, contact: contact(), step: STEP.contact, maxStep: STEP.contact, date: slot.date };
    s = reducer(s, { type: "slot", slot });
    expect(s.slotZip).toBe("33139");
    s = reducer(s, { type: "clearSlot" });
    expect(s.slot).toBeNull();
    expect(s.date).toBeNull();
    expect(s.maxStep).toBe(STEP.time);
    expect(s.contact.lastName).toBe("Rivera");
  });
});
