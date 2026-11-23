import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attributionFromRequest, isCampaign } from "@/lib/tracking/attribution";
import { leadPayload, schedulePayload } from "@/lib/tracking/meta-capi";
import { latestFbc, neutralId, normEmail, normName, normPhoneUS, normZip } from "@/lib/tracking/normalize";
import { pixelAllowed } from "@/lib/tracking/safe-url";
import { claimLead, insertRequest, type NewRequestRow } from "@/lib/requests/store";

// Brief 03: Meta's Lead and Schedule, what each request remembers about where it came from, and no Pixel on token pages.
vi.mock("server-only", () => ({}));
const sha = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");

describe("customer details are normalized before hashing", () => {
  it("phone as E.164 digits, email lowercased and trimmed, 5-digit ZIP, lowercased first name", () => {
    expect(normPhoneUS("+1 (305) 555-0142")).toBe("13055550142");
    expect(normPhoneUS("305.555.0142")).toBe("13055550142");
    expect(normPhoneUS("555-0142")).toBe("");
    expect(normEmail("  Ana.Gomez@Example.COM ")).toBe("ana.gomez@example.com");
    expect(normZip("33139-1234")).toBe("33139");
    expect(normName("  José ")).toBe("josé");
  });

  it("the Lead carries hashed em/ph/fn/zp/country/external_id, the browser's fbp/fbc/IP/UA, no value, neutral names", () => {
    const p = leadPayload(
      { eventId: "TH-R-20261114-1234", eventSourceUrl: "https://www.tinyhumans.photography/book", bundleId: "our-little-story", leadSource: "website", person: { email: " Ana@Example.com", phone: "+13055550142", name: "Ana", zip: "33139" }, client: { ip: "203.0.113.9", userAgent: "UA", fbp: "fb.1.1.2", fbc: "fb.1.3.abc" } },
      new Date("2026-11-14T15:00:00Z"),
    );
    expect(p).toMatchObject({ event_name: "Lead", event_id: "TH-R-20261114-1234", action_source: "website", event_source_url: "https://www.tinyhumans.photography/book", custom_data: { content_name: "request", content_ids: ["our-little-story"], lead_source: "website" } });
    expect(p.user_data).toMatchObject({ em: [sha("ana@example.com")], ph: [sha("13055550142")], fn: [sha("ana")], zp: [sha("33139")], country: [sha("us")], external_id: [sha("ana@example.com")], client_ip_address: "203.0.113.9", client_user_agent: "UA", fbp: "fb.1.1.2", fbc: "fb.1.3.abc" });
    expect(p.custom_data).not.toHaveProperty("value");
    expect(JSON.stringify(p)).not.toMatch(/due|pregnan|baby|newborn/i);
    // an owner's bundle id that names a baby is left out
    expect(leadPayload({ eventId: "x", eventSourceUrl: "u", bundleId: "newborn-mini", leadSource: "website", person: { email: "a@b.co", phone: "", name: "A", zip: "" }, client: {} }).custom_data).toEqual({ content_name: "request", lead_source: "website" });
    expect(neutralId("our-family-story")).toBe("our-family-story");
  });

  it("Schedule: the booking reference, its total, USD; 'chat' (confirmed by text) has no page URL", () => {
    const base = { eventId: "TH-20261201-0001", value: 319.1, bundleId: "our-little-story", bundleName: "Our Little Story", person: { email: "a@b.co", phone: "3055550142", name: "Ana Gómez", zip: "33139", city: "Miami Beach" }, client: {} };
    expect(schedulePayload({ ...base, actionSource: "website", eventSourceUrl: "https://www.tinyhumans.photography/book" })).toMatchObject({ event_name: "Schedule", event_id: "TH-20261201-0001", action_source: "website", custom_data: { currency: "USD", value: 319.1 } });
    const chat = schedulePayload({ ...base, actionSource: "chat" });
    expect(chat.action_source).toBe("chat");
    expect(chat).not.toHaveProperty("event_source_url");
    expect(chat.user_data.ln).toEqual([sha("gómez")]);
  });

  it("the newer Meta click id wins", () => {
    expect(latestFbc("fb.1.1000.old", "fb.1.2000.new")).toBe("fb.1.2000.new");
    expect(latestFbc("fb.1.3000.pixel", "fb.1.2000.ours")).toBe("fb.1.3000.pixel");
    expect(latestFbc(undefined, "fb.1.2000.ours")).toBe("fb.1.2000.ours");
    expect(latestFbc(null, null)).toBeUndefined();
  });
});

describe("where a request came from", () => {
  it("reads the Meta ad, ad set and campaign ids from our ad links (digits only)", () => {
    const t = attributionFromRequest(new URL("https://www.tinyhumans.photography/home-sweet-home?utm_source=meta&th_ad=1&th_adset=2&th_campaign=3"), null);
    expect(t).toMatchObject({ utmSource: "meta", adId: "1", adsetId: "2", campaignId: "3", landingPath: "/home-sweet-home" });
    expect(isCampaign(t)).toBe(true);
    expect(attributionFromRequest(new URL("https://www.tinyhumans.photography/?th_ad=abc<script>"), null).adId).toBeUndefined();
    expect(isCampaign(attributionFromRequest(new URL("https://www.tinyhumans.photography/book?bundle=x"), null))).toBe(false);
  });
});

describe("one Lead per person per 30 days", () => {
  beforeEach(() => {
    (globalThis as { __thBookingRequests?: unknown[] }).__thBookingRequests = [];
  });
  const base: NewRequestRow = { reference: "TH-R-1", clientId: "c1", type: "due_date", bundleId: "our-little-story", bundleName: "Our Little Story", bundleCents: 1, totalCents: 1, pricing: {}, dueDate: "2026-12-20", firstName: "Ana", mobile: "+13055550142", email: "ana@example.com", zip: "33139" };
  const add = (n: number, over: Partial<NewRequestRow> = {}) => insertRequest({ ...base, reference: `TH-R-${n}`, clientId: `c${n}`, ...over });

  it("a second request with the same email or the same mobile sends none; someone else's does; after 30 days, again", async () => {
    const now = new Date("2026-11-14T15:00:00Z");
    expect(await claimLead(await add(1), now)).toBe(true);
    expect(await claimLead(await add(2, { email: "ANA@example.com", mobile: "+13055550199" }), now)).toBe(false);
    expect(await claimLead(await add(3, { email: "other@example.com" }), now)).toBe(false);
    expect(await claimLead(await add(4, { email: "lucia@example.com", mobile: "+17865550199" }), now)).toBe(true);
    expect(await claimLead(await add(5), new Date(now.getTime() + 31 * 86_400_000))).toBe(true);
  });
});

describe("no Pixel on pages whose links carry a secret token", () => {
  it("token pages and token links are off; the booking pages are on", () => {
    for (const [path, search] of [["/pay", "?b=TH-1&s=x"], ["/cancel", "?t=abc"], ["/es/reschedule", "?t=abc"], ["/backdrop", "?t=abc"], ["/pay", "?d=TH-D-1&k=x"], ["/review", "?token=x"], ["/waiver", "?w=x&s=y"], ["/book", "?bundle=a&deposit=TH-1&k=x"], ["/book", "?bundle=a&due=tok"], ["/book", "?link=tok"], ["/es/book", "?link=tok"], ["/admin/requests", ""]]) {
      expect(pixelAllowed(path, search), `${path}${search}`).toBe(false);
    }
    for (const [path, search] of [["/", ""], ["/book", "?bundle=our-little-story&utm_source=meta&th_ad=1"], ["/es/book", "?bundle=a"], ["/bundles", "?inspiration=p1"], ["/home-sweet-home", "?fbclid=x"]]) {
      expect(pixelAllowed(path, search), `${path}${search}`).toBe(true);
    }
  });
});
