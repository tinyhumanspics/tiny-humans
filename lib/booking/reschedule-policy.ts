/**
 * Customer-facing reschedule policy wording, built from the owner's setting
 * (/admin > Availability > Customer reschedule notice). Never hard-coded.
 */
export function rescheduleNoticeText(hours: number): string {
  if (!hours || hours <= 0) return "Rescheduling: You can reschedule your session online any time before your appointment.";
  return `Rescheduling: You can reschedule your session online up to ${hours} ${hours === 1 ? "hour" : "hours"} before your appointment.`;
}
