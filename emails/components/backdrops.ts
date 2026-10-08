import { BACKDROPS } from "@/config/backdrops";
import { BACKDROP_IMAGES } from "@/lib/email/backdrop-assets";
import { emailMessages, type EmailLocale } from "@/lib/email/messages";
import type { EmailAttachment, ImageMode } from "@/lib/email/types";

export interface EmailSwatch {
  name: string;
  color: string;
  glow: string;
  edge: string;
  /** A drawn texture (CID or data URI) instead of the glow. */
  image?: string;
}

/** The backdrop swatches (all, or only `only`) with names in the email's language, plus the texture attachments. */
export function backdropSwatches(locale: EmailLocale, mode: ImageMode = "cid", only?: readonly string[]): { swatches: EmailSwatch[]; attachments: EmailAttachment[] } {
  const names = emailMessages(locale).backdrops.names as Record<string, string>;
  const attachments: EmailAttachment[] = [];
  const swatches = BACKDROPS.filter((b) => !only || only.includes(b.id)).map((b) => {
    const img = BACKDROP_IMAGES[b.id];
    let image: string | undefined;
    if (img) {
      const contentId = `th-backdrop-${b.id}`;
      if (mode === "inline") image = `data:${img.contentType};base64,${img.base64}`;
      else {
        attachments.push({ filename: img.filename, content: img.base64, contentType: img.contentType, contentId });
        image = `cid:${contentId}`;
      }
    }
    return { name: names[b.id] ?? b.id, color: b.color, glow: b.glow, edge: b.edge, image };
  });
  return { swatches, attachments };
}

/** "Blue Aura, Burgundy, Cream, White, Beige or Wooden" (plain-text versions). */
export function backdropList(locale: EmailLocale): string {
  const m = emailMessages(locale).backdrops;
  const names = BACKDROPS.map((b) => (m.names as Record<string, string>)[b.id] ?? b.id);
  return `${names.slice(0, -1).join(", ")} ${m.or} ${names[names.length - 1]}`;
}
