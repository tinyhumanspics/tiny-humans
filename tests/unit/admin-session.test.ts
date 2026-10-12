import { createHmac } from "crypto";
import { describe, expect, test } from "vitest";
import { passkeyLabel, relyingParty } from "@/lib/admin/passkey-rp";
import { createSessionToken, readSessionToken } from "@/lib/admin/session-token";

const SECRET = "unit-test-session-secret-0123456789";
const NOW = Date.UTC(2026, 9, 12, 12);

describe("owner session cookie", () => {
  test("a new session carries its epoch and expires after its max age", () => {
    const token = createSessionToken(SECRET, 3, 60, NOW);
    expect(readSessionToken(token, SECRET, NOW)).toEqual({ epoch: 3, expiresAt: NOW + 60_000 });
    expect(readSessionToken(token, SECRET, NOW + 61_000)).toBeNull();
  });

  test("cookies from before epochs existed read as epoch 0, so the upgrade signs nobody out", () => {
    const exp = String(NOW + 60_000);
    const legacy = `${exp}.${createHmac("sha256", SECRET).update(exp).digest("base64url")}`;
    expect(readSessionToken(legacy, SECRET, NOW)).toEqual({ epoch: 0, expiresAt: NOW + 60_000 });
  });

  test("a changed epoch, expiry or secret breaks the signature", () => {
    const [exp, , sig] = createSessionToken(SECRET, 0, 60, NOW).split(".");
    expect(readSessionToken(`${exp}.5.${sig}`, SECRET, NOW)).toBeNull();
    expect(readSessionToken(`${Number(exp) + 1}.0.${sig}`, SECRET, NOW)).toBeNull();
    expect(readSessionToken(createSessionToken(SECRET, 0, 60, NOW), "another-secret-0123456789", NOW)).toBeNull();
  });

  test("re-issuing with the original sign-in time keeps the original expiry", () => {
    const signedInAt = NOW - 20 * 60_000;
    expect(readSessionToken(createSessionToken(SECRET, 1, 60 * 60, signedInAt), SECRET, NOW)?.expiresAt).toBe(signedInAt + 60 * 60_000);
  });

  test("garbage is rejected", () => {
    for (const token of [undefined, "", "a.b.c.d", "abc", "1.x.y", `${NOW + 60_000}.-1.sig`]) {
      expect(readSessionToken(token, SECRET, NOW), String(token)).toBeNull();
    }
  });
});

describe("passkey relying party", () => {
  test("the live site's passkeys belong to the registrable domain, so www and bare both work", () => {
    expect(relyingParty({ url: "https://www.tinyhumans.photography/api/admin/passkeys/login" })).toEqual({ rpID: "tinyhumans.photography", origin: "https://www.tinyhumans.photography" });
    expect(relyingParty({ url: "https://tinyhumans.photography/api/x" }).rpID).toBe("tinyhumans.photography");
  });

  test("other hosts (local, previews, look-alikes) get their own relying party", () => {
    expect(relyingParty({ url: "http://localhost:3300/api/x" })).toEqual({ rpID: "localhost", origin: "http://localhost:3300" });
    expect(relyingParty({ url: "https://tiny-humans-git-x.vercel.app/api/x" }).rpID).toBe("tiny-humans-git-x.vercel.app");
    expect(relyingParty({ url: "https://tinyhumans.photography.evil.example/api/x" }).rpID).toBe("tinyhumans.photography.evil.example");
  });

  test("devices get a friendly name", () => {
    expect(passkeyLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15")).toBe("iPhone");
    expect(passkeyLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15")).toBe("Mac");
    expect(passkeyLabel("Mozilla/5.0 (Linux; Android 15; Pixel 9)")).toBe("Android phone");
    expect(passkeyLabel(null)).toBe("This device");
  });
});
