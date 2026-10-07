import type { TinyHumansTheme } from "@/config/themes";
import { emailImages } from "./theme";
import type { EmailAttachment, ImageMode } from "./types";

export interface EmailImageSet {
  logo: { src: string; width: number; height: number };
  strip: { src: string };
  /** Inline attachments to send with the email ("cid" mode only). */
  attachments: EmailAttachment[];
}

/** The theme's logo + doodle strip: inline CID attachments when sending, data URIs in browser previews. */
export function emailImageSet(themeId: TinyHumansTheme, mode: ImageMode): EmailImageSet {
  const imgs = emailImages(themeId);
  const attachments: EmailAttachment[] = [];
  const src = (key: "logo" | "strip") => {
    const im = imgs[key];
    if (mode === "inline") return `data:${im.contentType};base64,${im.base64}`;
    const contentId = `th-${key}-${themeId}`;
    attachments.push({ filename: im.filename, content: im.base64, contentType: im.contentType, contentId });
    return `cid:${contentId}`;
  };
  return { strip: { src: src("strip") }, logo: { src: src("logo"), width: imgs.logo.width, height: imgs.logo.height }, attachments };
}
