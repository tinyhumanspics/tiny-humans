import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookings, emailEvents, type Booking, type EmailEvent } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { emailConfig, isTagValue, sendEmail } from "./resend";
import { internalEmailProblemEmail } from "@/lib/email";

/**
 * Email delivery problems from Resend's webhook (/api/resend/webhook): bounced, marked as spam, not sent because the
 * address is on Resend's suppression list, or failed. Saved in `email_events` and shown on the family's lead in /admin;
 * the studio gets one email the first time an address has a problem. Env: RESEND_WEBHOOK_SECRET (`whsec_...`, from the
 * webhook's page in Resend).
 */
export type EmailProblem = "bounced" | "complained" | "suppressed" | "failed";

const EVENT_TYPES: Record<string, EmailProblem> = {
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.suppressed": "suppressed",
  "email.failed": "failed",
};

/** Which email it was, from its "category" tag (the send scope with "." → "_"). */
const EMAIL_NAMES: Record<string, string> = {
  resend_customer: "confirmation email",
  resend_reschedule: "new-time email",
  resend_cancellation: "cancellation email",
  "resend_reminder-72h": "3-day reminder",
  "resend_reminder-24h": "day-before reminder",
  resend_after_session: "sneak peek email",
  resend_gallery_delivered: "gallery email",
  resend_payment_link: "payment link email",
  resend_deposit_abandoned: "“not confirmed yet” email",
};
export const emailNameOf = (category: string | null) => (category && EMAIL_NAMES[category]) || "email";

/**
 * Svix signature check (how Resend signs webhooks): HMAC-SHA256 of "<svix-id>.<svix-timestamp>.<raw body>" with the
 * base64 part of the `whsec_` secret; `svix-signature` lists "v1,<base64>" values separated by spaces. 5-minute tolerance.
 */
export function verifyResendWebhook(rawBody: string, h: { id: string | null; timestamp: string | null; signature: string | null }, secret: string, now = Date.now()): boolean {
  if (!h.id || !h.timestamp || !h.signature || !secret.startsWith("whsec_")) return false;
  const t = Number(h.timestamp);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > 300) return false;
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const expected = Buffer.from(createHmac("sha256", key).update(`${h.id}.${h.timestamp}.${rawBody}`).digest("base64"));
  return h.signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const got = Buffer.from(sig);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

interface ResendEvent {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    tags?: Record<string, string> | { name: string; value: string }[];
    bounce?: { message?: string; type?: string; subType?: string };
    suppressed?: { message?: string; type?: string };
    failed?: { reason?: string };
  };
}

const tagsOf = (t: NonNullable<ResendEvent["data"]>["tags"]): Record<string, string> => (Array.isArray(t) ? Object.fromEntries(t.map((x) => [x.name, x.value])) : (t ?? {}));

function detailOf(type: EmailProblem, d: NonNullable<ResendEvent["data"]>): string | null {
  const parts =
    type === "bounced"
      ? [[d.bounce?.type, d.bounce?.subType].filter(Boolean).join(" / "), d.bounce?.message]
      : type === "suppressed"
        ? [d.suppressed?.type]
        : type === "failed"
          ? [d.failed?.reason]
          : [];
  return parts.filter(Boolean).join(": ").trim().slice(0, 300) || null;
}

/**
 * Saves the problem (once per webhook message and recipient) and emails the studio when it's the first problem for
 * that family's address. Throws only if it couldn't be saved (the route answers 500, so Resend retries).
 */
export async function handleResendEvent(event: ResendEvent, webhookId: string): Promise<{ saved: number }> {
  const type = event.type ? EVENT_TYPES[event.type] : undefined;
  const d = event.data;
  if (!type || !d) return { saved: 0 };
  const recipients = [d.to ?? []].flat().map((a) => String(a).trim().toLowerCase()).filter(Boolean);
  if (!recipients.length) return { saved: 0 };
  const tags = tagsOf(d.tags);
  const occurredAt = new Date(event.created_at ?? Date.now());
  const db = getDb();
  const rows = await db
    .insert(emailEvents)
    .values(
      recipients.map((recipient) => ({
        id: `${webhookId}/${recipient}`.slice(0, 400),
        type,
        emailId: d.email_id ?? null,
        recipient,
        bookingReference: isTagValue(tags.booking) ? tags.booking : null,
        category: isTagValue(tags.category) ? tags.category : null,
        detail: detailOf(type, d),
        occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
      })),
    )
    .onConflictDoNothing()
    .returning();
  for (const row of rows) await alertStudio(row).catch((err) => log.error("email.delivery", "Studio alert not sent", { error: err as Error, reference: row.bookingReference }));
  if (rows.length) log.warn("email.delivery", "Email problem reported by Resend", { type, references: rows.map((r) => r.bookingReference).join(",") });
  return { saved: rows.length };
}

/** The family's booking this problem is about: the email's booking tag, else their latest booking with that address. */
async function bookingFor(e: EmailEvent): Promise<Booking | null> {
  const db = getDb();
  if (e.bookingReference) {
    const [row] = await db.select().from(bookings).where(eq(bookings.bookingReference, e.bookingReference)).limit(1);
    return row && row.email.trim().toLowerCase() === e.recipient ? row : null;
  }
  const [row] = await db.select().from(bookings).where(sql`lower(${bookings.email}) = ${e.recipient}`).orderBy(desc(bookings.createdAt)).limit(1);
  return row ?? null;
}

/** One studio email per address: later problems with the same address (e.g. every reminder suppressed) stay quiet. */
async function alertStudio(e: EmailEvent): Promise<void> {
  const cfg = emailConfig();
  if (e.recipient === cfg.notify.trim().toLowerCase()) return; // the studio's own inbox
  const row = await bookingFor(e);
  if (!row) return; // not a family's email (or a booking that was deleted)
  const [earlier] = await getDb()
    .select({ id: emailEvents.id })
    .from(emailEvents)
    .where(and(eq(emailEvents.recipient, e.recipient), or(lt(emailEvents.createdAt, e.createdAt), and(eq(emailEvents.createdAt, e.createdAt), lt(emailEvents.id, e.id)))))
    .limit(1);
  if (earlier) return;
  const mail = await internalEmailProblemEmail({
    kind: e.type as EmailProblem,
    emailName: emailNameOf(e.category),
    detail: e.detail,
    at: e.occurredAt,
    reference: row.bookingReference,
    parentName: row.parentName,
    email: row.email,
    phone: row.phone,
    bundleName: row.packageName,
    sessionStart: row.sessionStart,
    cancelled: row.status === "cancelled",
  });
  await sendEmail({ scope: "resend.internal", from: cfg.internalFrom, to: cfg.notify, subject: mail.subject, html: mail.html, text: mail.text, idempotencyKey: `email-problem/${e.id}`.slice(0, 256), reference: row.bookingReference });
}

/** Problems for these bookings' addresses (empty if the table isn't there yet). */
export async function emailEventsFor(rows: Pick<Booking, "bookingReference" | "email">[]): Promise<EmailEvent[]> {
  if (!rows.length) return [];
  const addresses = [...new Set(rows.map((r) => r.email.trim().toLowerCase()))];
  try {
    return await getDb()
      .select()
      .from(emailEvents)
      .where(or(inArray(emailEvents.recipient, addresses), inArray(emailEvents.bookingReference, rows.map((r) => r.bookingReference))))
      .orderBy(desc(emailEvents.occurredAt));
  } catch (err) {
    log.warn("email.delivery", "Could not load email problems (run drizzle/0016_email_events.sql)", { reason: (err as { cause?: { message?: string } }).cause?.message });
    return [];
  }
}

/** A booking's problems: events about its own address, tagged with its reference (or untagged, after it was made). */
export function problemsOf(r: Pick<Booking, "bookingReference" | "email" | "createdAt">, events: EmailEvent[]): EmailEvent[] {
  const address = r.email.trim().toLowerCase();
  return events.filter((e) => e.recipient === address && (e.bookingReference ? e.bookingReference === r.bookingReference : e.occurredAt.getTime() >= r.createdAt.getTime()));
}
