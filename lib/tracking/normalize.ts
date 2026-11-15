/**
 * Normalization of customer details before hashing for Meta (Conversions API "customer information parameters"):
 * trimmed + lowercase; names/city without punctuation (city also without spaces), UTF-8 kept (José → "josé");
 * US phone with country code 1, digits only; ZIP = first 5 digits; state/country = 2-letter lowercase codes.
 * Pure functions (no Node APIs): also used for the Pixel's advanced matching in the browser.
 */
export const normEmail = (v?: string | null) => (v ? v.trim().toLowerCase() : "");

export function normPhoneUS(v?: string | null): string {
  let d = (v ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10) d = `1${d}`;
  return d.length >= 11 ? d : "";
}

const noPunct = (v: string) => v.normalize("NFC").toLowerCase().replace(/[\p{P}\p{S}]/gu, "");
export const normName = (v?: string | null) => (v ? noPunct(v).replace(/\s+/g, " ").trim() : "");
export const normCity = (v?: string | null) => (v ? noPunct(v).replace(/\s+/g, "") : "");
export const normZip = (v?: string | null) => (v ?? "").replace(/\D/g, "").slice(0, 5);

/** "José Muñoz de la Cruz" -> { fn: "josé", ln: "cruz" } (first and last word). */
export function splitName(full?: string | null): { fn: string; ln: string } {
  const parts = normName(full).split(" ").filter(Boolean);
  return { fn: parts[0] ?? "", ln: parts.length > 1 ? parts[parts.length - 1] : "" };
}

/** The newer of two Meta click ids ("fb.1.<ms>.<fbclid>"): the Pixel's _fbc and our th_fbc can disagree. */
export function latestFbc(a?: string | null, b?: string | null): string | undefined {
  const at = (v?: string | null) => Number(v?.split(".")[2] ?? 0) || 0;
  if (!a) return b || undefined;
  if (!b) return a;
  return at(b) > at(a) ? b : a;
}

/** Ids sent to Meta stay neutral (Meta's personal-attributes policy): a bundle id saying "newborn" isn't sent. */
export const neutralId = (id: string) => (/(due|pregnan|baby|babies|newborn)/i.test(id) ? undefined : id);
