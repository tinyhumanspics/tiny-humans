import { z } from "zod";
import { bookingRules } from "@/config/booking";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time.");
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const L = bookingRules.limits;

export const weeklyDaySchema = z
  .object({ weekday: z.number().int().min(0).max(6), isOpen: z.boolean(), start: hhmm, end: hhmm })
  .refine((d) => !d.isOpen || d.end > d.start, "Closing time must be after opening time.");

export const weeklyAndLimitsSchema = z.object({
  weekly: z
    .array(weeklyDaySchema)
    .length(7)
    .refine((days) => new Set(days.map((d) => d.weekday)).size === 7, "Each weekday must appear once."),
  limits: z.object({
    minimumNoticeDays: z.number().int().min(0).max(L.maxNoticeDays),
    bookingWindowDays: z.number().int().min(1).max(L.maxWindowDays),
    bufferMinutes: z.number().int().min(0).max(L.maxBufferMinutes),
    rescheduleNoticeHours: z.number().int().min(0).max(L.maxRescheduleNoticeHours).default(48),
  }),
});

export const overrideSchema = z
  .object({ date: dateKey, isClosed: z.boolean(), start: hhmm.optional(), end: hhmm.optional() })
  .refine((o) => o.isClosed || (o.start && o.end && o.end > o.start), "Add opening and closing times (closing after opening), or mark the day closed.");

export const blockSchema = z
  .object({ date: dateKey, start: hhmm, end: hhmm, reason: z.string().trim().max(120).optional() })
  .refine((b) => b.end > b.start, "The end time must be after the start time.");
