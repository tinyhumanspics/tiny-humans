import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingRequestRow } from "@/lib/db/schema";
import { leadPayload, type LeadEvent } from "@/lib/tracking/meta-capi";

// Brief 05b task 10: every Lead says where the request came from (/book or the owner's booking link).
vi.mock("server-only", () => ({}));
vi.mock("@/lib/requests/store", () => ({ claimLead: async () => true }));
const sent: LeadEvent[] = [];
vi.mock("@/lib/tracking/meta-capi", async (actual) => ({ ...(await actual<typeof import("@/lib/tracking/meta-capi")>()), sendLeadEvent: async (e: LeadEvent) => void sent.push(e) }));

const { onRequestCreated } = await import("@/lib/requests/hooks");
const row = { reference: "TH-R-20261122-0001", locale: "en", bundleId: "our-little-story", email: "ana@example.com", mobile: "3055550142", firstName: "Ana", zip: "33139", clientIp: null, userAgent: null, fbp: null, fbc: null } as unknown as BookingRequestRow;

describe("lead_source on every Lead", () => {
  beforeEach(() => void (sent.length = 0));

  it("a request from the owner's booking link sends a Lead with lead_source booking_link", async () => {
    expect(await onRequestCreated(row, "booking_link")).toEqual({ lead: true });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(leadPayload(sent[0]).custom_data).toMatchObject({ lead_source: "booking_link" });
  });

  it("a request from /book sends a Lead with lead_source website", async () => {
    await onRequestCreated(row, "website");
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(leadPayload(sent[0]).custom_data).toMatchObject({ lead_source: "website" });
  });
});
