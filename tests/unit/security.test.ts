import { describe, expect, test } from "vitest";
import { sanitizeLogFields } from "@/lib/security/logging";
import { hasTrustedMutationOrigin } from "@/lib/security/origin";
import { matchesPhotoSignature } from "@/lib/security/uploads";
import { TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";

describe("safe logging", () => {
  test("removes personal and secret fields recursively", () => {
    expect(
      sanitizeLogFields({
        reference: "TH-123",
        email: "family@example.com",
        nested: { phone: "3055550100", fullName: "Ada Parent", clientIp: "192.0.2.1", status: "failed", accessToken: "secret" },
      }),
    ).toEqual({ reference: "TH-123", nested: { status: "failed" } });
  });

  test("keeps error codes but never error messages", () => {
    const cause = Object.assign(new Error("Key (email)=(family@example.com) already exists"), {
      code: "23505",
      constraint: "bookings_email_key",
    });
    const error = Object.assign(new Error('insert values ("Ada", "family@example.com")'), { cause });
    const result = sanitizeLogFields({ error });
    expect(result).toEqual({
      error: { name: "Error", causeName: "Error", causeCode: "23505", constraint: "bookings_email_key" },
    });
    expect(JSON.stringify(result)).not.toContain("family@example.com");
    expect(JSON.stringify(result)).not.toContain("Ada");
  });
});

describe("owner mutation origin", () => {
  const request = (method: string, origin?: string, referer?: string) => ({
    method,
    url: "https://www.tinyhumans.photography/api/admin/settings",
    headers: new Headers({ ...(origin ? { origin } : {}), ...(referer ? { referer } : {}) }),
  });

  test("allows safe methods and exact same-origin mutations", () => {
    expect(hasTrustedMutationOrigin(request("GET"))).toBe(true);
    expect(hasTrustedMutationOrigin(request("PUT", "https://www.tinyhumans.photography"))).toBe(true);
    expect(hasTrustedMutationOrigin(request("POST", undefined, "https://www.tinyhumans.photography/admin"))).toBe(true);
  });

  test("rejects missing, null, sibling and lookalike origins", () => {
    expect(hasTrustedMutationOrigin(request("POST"))).toBe(false);
    expect(hasTrustedMutationOrigin(request("POST", "null"))).toBe(false);
    expect(hasTrustedMutationOrigin(request("POST", "null", "https://www.tinyhumans.photography/admin"))).toBe(false);
    expect(hasTrustedMutationOrigin(request("POST", "https://admin.tinyhumans.photography"))).toBe(false);
    expect(hasTrustedMutationOrigin(request("POST", "https://www.tinyhumans.photography.evil.example"))).toBe(false);
  });
});

describe("photo signatures", () => {
  test("accepts only signatures matching the claimed MIME type", () => {
    expect(matchesPhotoSignature("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(matchesPhotoSignature("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(matchesPhotoSignature("image/webp", new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe(true);
    expect(matchesPhotoSignature("image/png", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
    expect(matchesPhotoSignature("image/jpeg", new TextEncoder().encode("not an image"))).toBe(false);
  });
});

describe("bounded JSON request bodies", () => {
  const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
    new Request("https://www.tinyhumans.photography/api/booking/quote", { method: "POST", body, headers, duplex: "half" } as RequestInit);

  test("reads a body within its limit", async () => {
    await expect(readJson(post(JSON.stringify({ bundleId: "little-moments" })), 1024)).resolves.toEqual({ bundleId: "little-moments" });
  });

  test("answers null for a missing or malformed body", async () => {
    await expect(readJson(post(null), 1024)).resolves.toBeNull();
    await expect(readJson(post("{not json"), 1024)).resolves.toBeNull();
  });

  test("refuses a body whose declared size is over the limit", async () => {
    await expect(readJson(post("{}", { "content-length": "4096" }), 1024)).resolves.toBe(TOO_LARGE);
  });

  test("counts streamed bytes, so leaving out Content-Length can't get around the limit", async () => {
    const chunk = new TextEncoder().encode(`"${"x".repeat(600)}`);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.close();
      },
    });
    const request = post(stream);
    expect(request.headers.get("content-length")).toBeNull();
    await expect(readJson(request, 1024)).resolves.toBe(TOO_LARGE);
  });

  test("the too-large answer is a 413 with a short message", async () => {
    const response = tooLargeResponse({ "cache-control": "no-store" });
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "That request is too large.", code: "too_large" });
  });
});
