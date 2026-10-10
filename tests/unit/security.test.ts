import { describe, expect, test } from "vitest";
import { sanitizeLogFields } from "@/lib/security/logging";
import { hasTrustedMutationOrigin } from "@/lib/security/origin";
import { matchesPhotoSignature } from "@/lib/security/uploads";

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
