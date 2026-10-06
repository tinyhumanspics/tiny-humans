/** A rendered email, ready to hand to Resend (or to preview in the prototype). */
export interface EmailAttachment {
  filename: string;
  /** base64 */
  content: string;
  contentType: string;
  /** Referenced in the HTML as src="cid:<contentId>" */
  contentId: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
}

/** "cid": images embedded as inline attachments (sending). "inline": data URIs (browser previews). */
export type ImageMode = "cid" | "inline";
