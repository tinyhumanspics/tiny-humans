import { site } from "@/config/site";
import en from "@/messages/en.json";

/**
 * Customer-facing cancel/reschedule wording, built from the notice hours (/admin > Availability > "Cancel &
 * reschedule notice"; each booking keeps the hours in force when it was made). Never hard-code the number.
 */
const m = en.policy;
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (all, k: string) => v[k] ?? all);

/** "48 hours" / "1 hour" */
export const noticeLabel = (hours: number, messages: Pick<typeof m, "hour" | "hours"> = m) => fill(hours === 1 ? messages.hour : messages.hours, { n: String(hours) });

/** "You can reschedule or cancel online up to 48 hours before your session. After that, just text us at …" */
export const changePolicyText = (hours: number, messages: Pick<typeof m, "hour" | "hours" | "online"> = m) => fill(messages.online, { notice: noticeLabel(hours, messages), phone: site.contact.phone });

/** Shown on the cancel / reschedule pages once online changes are closed. */
export const cancelClosedText = (hours: number) => fill(m.closedCancel, { notice: noticeLabel(hours), phone: site.contact.phone });
export const rescheduleClosedText = (hours: number) => fill(m.closedReschedule, { notice: noticeLabel(hours), phone: site.contact.phone });
