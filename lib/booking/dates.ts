import type { DateKey } from "./types";
import type { AppLocale } from "@/i18n/config";

export function toDateKey(d: Date): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatLongDate(key: DateKey, locale: AppLocale = "en"): string {
  if (locale === "es") {
    // WebKit's `es-US` formatter uses US month/day ordering, while Chromium uses Spanish ordering.
    // Build this small fixed format ourselves so customer emails read the same everywhere.
    const date = fromDateKey(key);
    const weekdays = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;
    return `${weekdays[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
  }
  return fromDateKey(key).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeLabel(hhmm: string, locale: AppLocale = "en"): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = locale === "es" ? (h >= 12 ? "p. m." : "a. m.") : h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
