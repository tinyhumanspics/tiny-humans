import type { Lead } from "./types";

export interface ContactForDuplicateCheck {
  reference: string;
  status: Lead["status"];
  email: string;
  phone: string;
}

const emailKey = (value: string) => value.trim().toLowerCase();

/** Treat +1 (305)… and (305)… as the same US number, while preserving longer international numbers. */
const phoneKey = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
};

/**
 * Active bookings that share a parent's email or phone. Cancelled history is deliberately ignored: a family booking
 * again after a cancellation is expected, while two simultaneous active bookings are worth the owner's attention.
 */
export function duplicateBookingsFor(targets: ContactForDuplicateCheck[], all: ContactForDuplicateCheck[]) {
  const active = all.filter((lead) => lead.status !== "cancelled");
  const byEmail = new Map<string, string[]>();
  const byPhone = new Map<string, string[]>();

  for (const lead of active) {
    const email = emailKey(lead.email);
    const phone = phoneKey(lead.phone);
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), lead.reference]);
    if (phone) byPhone.set(phone, [...(byPhone.get(phone) ?? []), lead.reference]);
  }

  return new Map(
    targets.flatMap((lead) => {
      if (lead.status === "cancelled") return [];
      const emailReferences = (byEmail.get(emailKey(lead.email)) ?? []).filter((reference) => reference !== lead.reference);
      const phoneReferences = (byPhone.get(phoneKey(lead.phone)) ?? []).filter((reference) => reference !== lead.reference);
      return emailReferences.length || phoneReferences.length ? [[lead.reference, { emailReferences, phoneReferences }] as const] : [];
    }),
  );
}
