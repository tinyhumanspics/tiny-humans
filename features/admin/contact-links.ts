/** US numbers as +1XXXXXXXXXX for tel:/sms: links. */
function dialNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

/** "sms:" link that opens Messages with the text filled in (works on iPhone and Android). */
export function smsHref(phone: string, body: string): string {
  return `sms:${dialNumber(phone)}?&body=${encodeURIComponent(body)}`;
}

export const telHref = (phone: string) => `tel:${dialNumber(phone)}`;
