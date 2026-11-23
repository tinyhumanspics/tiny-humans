import "server-only";
import { createHash } from "crypto";
import { log } from "@/lib/log";
import { errorCode, reportFailure } from "@/lib/monitoring/report";
import { neutralId as neutral, normCity, normEmail, normPhoneUS, normZip, splitName } from "./normalize";

/**
 * Meta Conversions API (server side), brief 03:
 * - Lead: one per real request (at most one per person per 30 days), deduplicated with the browser Pixel's Lead through
 *   the same event_id (the request's reference) + event_name.
 * - Schedule: one per booking when it's confirmed (pay-link deposit paid, or confirmed by the owner with nothing to
 *   pay), event_id = the booking reference; with the request's match data when it came from one.
 *
 * Env: NEXT_PUBLIC_META_PIXEL_ID (dataset id), META_CAPI_ACCESS_TOKEN (server only), META_TEST_EVENT_CODE (optional,
 * testing only: events with it go to "Test events" and are NOT used by ads; never set it in Production). Missing
 * config = quietly does nothing. Never throws: a tracking problem must never affect a request or a booking.
 *
 * Children's privacy and Meta's personal-attributes policy: only the parent's contact details are sent (hashed), with
 * neutral names (never "due date", "pregnant", "baby" or "newborn"). Never baby names, ages, notes or photos.
 */
export const META_GRAPH_VERSION = "v27.0";
/** META_GRAPH_BASE_URL is for local tests only (scripts/local-db/fake-meta.mjs); never set it on Vercel. */
const graphBase = () => (process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com").replace(/\/$/, "");

const sha256 = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");
const hashed = (v: string) => (v ? [sha256(v)] : undefined);

/** The family's browser when they sent the request (or came back from paying). */
export interface MetaClient {
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

/** What Meta matches a person on. `name` is a full name or a first name; city is optional. */
export interface MetaPerson {
  email: string;
  phone: string;
  name: string;
  zip: string;
  city?: string;
}

function userData(p: MetaPerson, client: MetaClient) {
  const { fn, ln } = splitName(p.name);
  const email = normEmail(p.email);
  return {
    em: hashed(email),
    ph: hashed(normPhoneUS(p.phone)),
    fn: hashed(fn),
    ln: hashed(ln),
    ct: hashed(normCity(p.city)),
    st: hashed("fl"),
    zp: hashed(normZip(p.zip)),
    country: hashed("us"),
    external_id: hashed(email),
    client_ip_address: client.ip || undefined,
    client_user_agent: client.userAgent || undefined,
    fbp: client.fbp || undefined,
    fbc: client.fbc || undefined,
  };
}

/** Where a request came from: /book ("website") or the owner's "Send a booking link" ("booking_link"). */
export type LeadSource = "website" | "booking_link";

export interface LeadEvent {
  /** The request's reference (the browser Pixel's eventID). */
  eventId: string;
  /** /book (or /es/book), never a URL with a token. */
  eventSourceUrl: string;
  bundleId: string;
  leadSource: LeadSource;
  person: MetaPerson;
  client: MetaClient;
}

/** The Conversions API payload for a request (exported for tests). No value: a request isn't a sale. */
export function leadPayload(e: LeadEvent, now = new Date()) {
  const id = neutral(e.bundleId);
  return {
    event_name: "Lead",
    event_time: Math.floor(now.getTime() / 1000),
    event_id: e.eventId,
    action_source: "website",
    event_source_url: e.eventSourceUrl,
    user_data: userData(e.person, e.client),
    custom_data: { content_name: "request", ...(id ? { content_ids: [id] } : {}), lead_source: e.leadSource },
  };
}

export interface ScheduleEvent {
  /** The booking's (or due-date reservation's) reference. */
  eventId: string;
  /**
   * "website": paid from the family's link on our site. "chat": the owner confirmed it by text with nothing to pay
   * (Meta: "a conversion made via a messaging app, SMS, or online messaging feature").
   */
  actionSource: "website" | "chat";
  /** Required for "website" events: a page without tokens. */
  eventSourceUrl?: string;
  value: number;
  bundleId: string;
  bundleName: string;
  person: MetaPerson;
  client: MetaClient;
}

/** The Conversions API payload for a booking (exported for tests). */
export function schedulePayload(e: ScheduleEvent, now = new Date()) {
  const id = neutral(e.bundleId);
  return {
    event_name: "Schedule",
    event_time: Math.floor(now.getTime() / 1000),
    event_id: e.eventId,
    action_source: e.actionSource,
    ...(e.eventSourceUrl ? { event_source_url: e.eventSourceUrl } : {}),
    user_data: userData(e.person, e.client),
    custom_data: {
      currency: "USD",
      value: Math.round(e.value * 100) / 100,
      content_name: e.bundleName,
      ...(id ? { content_ids: [id] } : {}),
      content_type: "product",
    },
  };
}

export function isCapiConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN);
}

async function send(name: "Lead" | "Schedule", event: object, logged: Record<string, string> = {}): Promise<void> {
  if (!isCapiConfigured()) return;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID!;
  const testCode = process.env.META_TEST_EVENT_CODE?.trim();
  const body = { data: [event], ...(testCode ? { test_event_code: testCode } : {}) };
  const url = `${graphBase()}/${META_GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(process.env.META_CAPI_ACCESS_TOKEN!)}`;
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(8000) });
    const data = (await res.json().catch(() => ({}))) as { events_received?: number; fbtrace_id?: string; error?: { message?: string; code?: number; error_subcode?: number } };
    if (!res.ok) {
      log.error("meta.capi", `${name} event rejected`, { status: res.status, code: data.error?.code, subcode: data.error?.error_subcode, test: Boolean(testCode) });
      await reportFailure("meta_capi", `${name} event rejected (HTTP ${res.status}, code ${data.error?.code ?? "?"}/${data.error?.error_subcode ?? "-"})`);
      return;
    }
    log.info("meta.capi", `${name} event sent`, { received: data.events_received, fbtrace: data.fbtrace_id, test: Boolean(testCode), ...logged });
  } catch (err) {
    log.error("meta.capi", `${name} event not sent`, { error: err as Error });
    await reportFailure("meta_capi", `${name} event not sent (${errorCode(err)})`);
  }
}

export const sendLeadEvent = (e: LeadEvent) => send("Lead", leadPayload(e), { leadSource: e.leadSource });
export const sendScheduleEvent = (e: ScheduleEvent) => send("Schedule", schedulePayload(e));
