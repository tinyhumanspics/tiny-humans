import "server-only";
import { after } from "next/server";
import { site } from "@/config/site";
import { localePath } from "@/i18n/path";
import type { BookingRequestRow } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { sendLeadEvent, type LeadSource } from "@/lib/tracking/meta-capi";
import { claimLead } from "./store";

/** Runs `fn` after the response (never slows the family down); outside a request (tests, scripts), right away. */
function later(fn: () => Promise<void>) {
  try {
    after(fn);
  } catch {
    void fn();
  }
}

/**
 * Runs once when a new request is saved (brief 02), before the answer. Brief 03: Meta's Lead, at most one per person
 * per 30 days (the same email or mobile within that time saves the request but sends none). The server event goes
 * after the response; `lead` tells the browser to send its Pixel Lead with the same event id (the reference).
 * `leadSource`: "booking_link" for a request sent from the owner's booking link (still a Lead, decision #31).
 */
export async function onRequestCreated(row: BookingRequestRow, leadSource: LeadSource): Promise<{ lead: boolean }> {
  const lead = await claimLead(row).catch((err) => {
    log.error("requests.lead", "Lead not claimed (none sent)", { reference: row.reference, error: err as Error });
    return false;
  });
  if (lead) {
    later(() =>
      sendLeadEvent({
        eventId: row.reference,
        eventSourceUrl: `${site.url.replace(/\/$/, "")}${localePath("/book", row.locale === "es" ? "es" : "en")}`,
        bundleId: row.bundleId,
        leadSource,
        person: { email: row.email, phone: row.mobile, name: row.firstName, zip: row.zip },
        client: { ip: row.clientIp, userAgent: row.userAgent, fbp: row.fbp, fbc: row.fbc },
      }),
    );
  }
  return { lead };
}
