import type en from "@/messages/en.json";
import type { Delivery, ExtraLine } from "./types";

/** The family's words for the extras (page, Stripe, emails), from the page's messages (`messages.extras`). */
type ExtrasMessages = typeof en.extras;

/** "Extra edited photos × 4", "Full gallery, color-corrected and retouched", "Unedited RAW files". */
export const lineName = (line: Pick<ExtraLine, "kind" | "quantity">, m: ExtrasMessages) =>
  line.kind === "extra_photos" ? m.lines.extra_photos.replace("{n}", String(line.quantity)) : m.lines[line.kind];

/** "72 hours", "7 days". */
export const deliveryText = (d: Delivery, m: ExtrasMessages) => m.within[d.unit].replace("{n}", String(d.amount));
