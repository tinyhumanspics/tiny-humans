import { expect, type Page } from "@playwright/test";

/**
 * The booking form's boxes (owner, Nov 13): step 1 asks first name, email and ZIP code (enough for the calendar), and
 * the contact step after the time ("Next: Home") asks last name, phone and the home address.
 */
export const FIRST = { firstName: "José", email: "jose.test@example.com", zip: "33139" };
export const HOME = { lastName: "Muñoz", phone: "(305) 555-0142", street: "1500 Bay Rd", city: "Miami Beach" };
const FIRST_KEYS = new Set(["firstName", "email", "zip"]);

/** What each test typed for the contact step (filled when it gets there). */
const later = new WeakMap<Page, Record<string, string>>();

/** Step 1: fills the first-step boxes; any other box (lastName, phone, street, unit, access…) waits for the contact step. */
export async function fillFirstStep(page: Page, fields: Record<string, string> = {}) {
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
  // by role: WebKit can keep a hidden streaming copy of the step for a moment (never visible, not in the accessibility tree)
  await expect(page.getByRole("paragraph").filter({ hasText: "We just need your information first. On the next step, you'll see the available dates." })).toBeVisible();
  const all = { ...FIRST, ...HOME, ...fields };
  const contact: Record<string, string> = {};
  for (const [field, value] of Object.entries(all)) {
    if (FIRST_KEYS.has(field)) await page.fill(`#field-${field}`, value);
    else contact[field] = value;
  }
  later.set(page, contact);
}

/** From the time step: "Next: Home", the contact step's boxes, then "Next: Details". */
export async function toDetails(page: Page) {
  await page.getByRole("button", { name: /Next: Home/ }).click();
  await expect(page.getByRole("heading", { name: "Your phone and home" })).toBeVisible();
  for (const [field, value] of Object.entries(later.get(page) ?? HOME)) await page.fill(`#field-${field}`, value);
  await page.getByRole("button", { name: /Next: Details/ }).click();
  await expect(page.getByRole("heading", { name: "Tell us about your family" })).toBeVisible();
}
