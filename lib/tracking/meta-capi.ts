import "server-only";
import { createHash } from "crypto";
import { log } from "@/lib/log";
import { normCity, normEmail, normPhoneUS, normZip, splitName } from "./normalize";

/**
 * Meta Conversions API (server side). Sends the booking ("Schedule") from our server so it's counted even when an
 * ad blocker or iOS privacy feature stops the browser Pixel. Deduplicated with the Pixel through the same
 * event_id (the booking's requestId) + event_name.
 *
 * Env: NEXT_PUBLIC_META_PIXEL_ID (dataset id), META_CAPI_ACCESS_TOKEN (server only), META_TEST_EVENT_CODE (optional,
 * testing only — events with it go to "Test events" and are NOT used by ads). Missing config = quietly does nothing.
 * Never throws: a tracking problem must never affect a booking.
 *
 * Children's privacy: only the parent's contact details are sent (hashed). Never baby names, ages, notes or photos.
 */
export const META_GRAPH_VERSION = "v26.0";

const sha256 = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");
const hashed = (v: string) => (v ? [sha256(v)] : undefined);

export interface ScheduleEvent {
  eventId: string;
  eventSourceUrl: string;
  value: number;
  bundleId: string;
  bundleName: string;
  contact: { parentName: string; email: string; phone: string };
  address: { city: string; zip: string };
  client: { ip?: string; userAgent?: string; fbp?: string; fbc?: string };
}

export function isCapiConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN);
}

/** The Conversions API payload for a booking (exported for tests). */
export function schedulePayload(e: ScheduleEvent, now = new Date()) {
  const { fn, ln } = splitName(e.contact.parentName);
  const email = normEmail(e.contact.email);
  return {
    event_name: "Schedule",
    event_time: Math.floor(now.getTime() / 1000),
    event_id: e.eventId,
    action_source: "website",
    event_source_url: e.eventSourceUrl,
    user_data: {
      em: hashed(email),
      ph: hashed(normPhoneUS(e.contact.phone)),
      fn: hashed(fn),
      ln: hashed(ln),
      ct: hashed(normCity(e.address.city)),
      st: hashed("fl"),
      zp: hashed(normZip(e.address.zip)),
      country: hashed("us"),
      external_id: hashed(email),
      client_ip_address: e.client.ip || undefined,
      client_user_agent: e.client.userAgent || undefined,
      fbp: e.client.fbp || undefined,
      fbc: e.client.fbc || undefined,
    },
    custom_data: {
      currency: "USD",
      value: Math.round(e.value * 100) / 100,
      content_name: e.bundleName,
      content_ids: [e.bundleId],
      content_type: "product",
    },
  };
}

export async function sendScheduleEvent(e: ScheduleEvent): Promise<void> {
  if (!isCapiConfigured()) return;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID!;
  const testCode = process.env.META_TEST_EVENT_CODE?.trim();
  const body = { data: [schedulePayload(e)], ...(testCode ? { test_event_code: testCode } : {}) };
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(process.env.META_CAPI_ACCESS_TOKEN!)}`;
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(8000) });
    const data = (await res.json().catch(() => ({}))) as { events_received?: number; fbtrace_id?: string; error?: { message?: string; code?: number; error_subcode?: number } };
    if (!res.ok) {
      log.error("meta.capi", "Schedule event rejected", { status: res.status, code: data.error?.code, subcode: data.error?.error_subcode, test: Boolean(testCode) });
      return;
    }
    log.info("meta.capi", "Schedule event sent", { received: data.events_received, fbtrace: data.fbtrace_id, test: Boolean(testCode) });
  } catch (err) {
    log.error("meta.capi", "Schedule event not sent", { error: err as Error });
  }
}
