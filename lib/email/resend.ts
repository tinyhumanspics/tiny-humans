import "server-only";
import { Resend } from "resend";
import { log } from "@/lib/log";

/** Tag values Resend accepts (ASCII letters, numbers, "_" and "-", up to 256 characters). */
export const isTagValue = (v: string | undefined): v is string => Boolean(v && /^[A-Za-z0-9_-]{1,256}$/.test(v));

/**
 * Booking emails via Resend (server only). Microsoft Graph is used for the
 * Outlook calendar only. Env: RESEND_API_KEY, BOOKING_FROM_EMAIL,
 * BOOKING_NOTIFICATION_EMAIL (never NEXT_PUBLIC).
 */
export function emailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY ?? "",
    /** Customer emails. */
    from: process.env.BOOKING_FROM_EMAIL || "Tiny Humans <hello@tinyhumans.photography>",
    /** Internal emails (falls back to BOOKING_FROM_EMAIL). */
    internalFrom: process.env.BOOKING_INTERNAL_FROM_EMAIL || process.env.BOOKING_FROM_EMAIL || "Tiny Humans <hello@tinyhumans.photography>",
    notify: process.env.BOOKING_NOTIFICATION_EMAIL || "hello@tinyhumans.photography",
  };
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

let client: Resend | null = null;
function resend(): Resend {
  if (!client) client = new Resend(emailConfig().apiKey);
  return client;
}

export class EmailSendError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EmailSendError";
    this.code = code;
  }
}

export interface OutgoingEmail {
  /** "resend.customer" | "resend.internal" | ... (used for logs) */
  scope: string;
  /** Defaults to BOOKING_FROM_EMAIL. */
  from?: string;
  /** Inline images (src="cid:<contentId>"). */
  attachments?: { filename: string; content: string; contentType: string; contentId: string }[];
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Same key = Resend won't send twice (e.g. on retries). */
  idempotencyKey?: string;
  reference?: string;
}

/** Sends one email. Returns the Resend message id; throws EmailSendError (no secrets) on failure. */
export async function sendEmail(email: OutgoingEmail): Promise<{ id: string | null }> {
  if (!isResendConfigured()) {
    log.error(email.scope, "Email not sent: RESEND_API_KEY is not set", { reference: email.reference });
    throw new EmailSendError("not_configured", "RESEND_API_KEY is not set");
  }
  try {
    const { data, error } = await resend().emails.send(
      {
        from: email.from ?? emailConfig().from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: email.replyTo,
        attachments: email.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType, contentId: a.contentId })),
        // "booking" lets the delivery webhook (lib/email/delivery.ts) find the lead an email was about
        tags: [{ name: "category", value: email.scope.replace(/[^a-zA-Z0-9_-]/g, "_") }, ...(isTagValue(email.reference) ? [{ name: "booking", value: email.reference }] : [])],
      },
      email.idempotencyKey ? { idempotencyKey: email.idempotencyKey } : undefined,
    );
    if (error || !data) {
      const code = (error as { name?: string } | null)?.name ?? "send_failed";
      log.error(email.scope, "Resend rejected the email", { code, detail: (error as { message?: string } | null)?.message, reference: email.reference });
      throw new EmailSendError(code, (error as { message?: string } | null)?.message ?? "Resend send failed");
    }
    log.info(email.scope, "Email sent", { messageId: data.id, reference: email.reference });
    return { id: data.id ?? null };
  } catch (err) {
    if (err instanceof EmailSendError) throw err;
    log.error(email.scope, "Could not reach Resend", { error: err as Error, reference: email.reference });
    throw new EmailSendError("network_error", "Could not reach Resend");
  }
}
