import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { asc, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { getDb, isDatabaseConfigured, isUndefinedTable } from "@/lib/db/client";
import { adminAuth, adminPasskeys, type AdminPasskey } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { relyingParty, passkeyLabel } from "./passkey-rp";

/**
 * The owner's passkeys (Face ID / Touch ID / device PIN) for /admin, with SimpleWebAuthn.
 * User verification is required both when adding a device and when signing in; passkeys are discoverable, so
 * sign-in needs no username. Each ceremony's challenge lives in a signed, httpOnly, 5-minute, single-use cookie.
 */

const CHALLENGE_COOKIE = "th_webauthn";
const CHALLENGE_PATH = "/api/admin/passkeys";
const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_PASSKEYS = 10;

type Ceremony = "register" | "login";

/** A key only for challenge cookies, derived from ADMIN_SESSION_SECRET. */
const challengeKey = () => createHmac("sha256", process.env.ADMIN_SESSION_SECRET ?? "").update("webauthn-challenge:v1").digest();
const signChallenge = (value: string) => createHmac("sha256", challengeKey()).update(value).digest("base64url");

async function rememberChallenge(kind: Ceremony, challenge: string): Promise<void> {
  const payload = `${kind}.${Date.now() + CHALLENGE_TTL_MS}.${challenge}`;
  (await cookies()).set(CHALLENGE_COOKIE, `${payload}.${signChallenge(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: CHALLENGE_PATH,
    maxAge: CHALLENGE_TTL_MS / 1000,
  });
}

/** The pending challenge for this ceremony, removed so it can't be used twice (null if missing/expired/forged). */
async function takeChallenge(kind: Ceremony): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CHALLENGE_COOKIE)?.value;
  store.set(CHALLENGE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: CHALLENGE_PATH, maxAge: 0 });
  const parts = value?.split(".") ?? [];
  if (parts.length !== 4) return null;
  const [k, exp, challenge, sig] = parts;
  const expected = Buffer.from(signChallenge(`${k}.${exp}.${challenge}`));
  const got = Buffer.from(sig);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  return k === kind && Number(exp) > Date.now() ? challenge : null;
}

export class PasskeyError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const unavailable = () => new PasskeyError("Face ID / Touch ID sign-in needs a one-time database update first. Use the password for now.", 503);

/** Passkeys can be used: database connected and migration 0020 applied. */
export async function passkeysReady(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    await getDb().select({ id: adminPasskeys.id }).from(adminPasskeys).limit(1);
    return true;
  } catch (err) {
    if (!isUndefinedTable(err)) log.error("admin.passkey", "Could not read passkeys", { error: err as Error });
    return false;
  }
}

/** At least one passkey exists (the sign-in page only offers Face ID / Touch ID then). */
export async function hasPasskeys(): Promise<boolean> {
  if (!(await passkeysReady())) return false;
  const [row] = await getDb().select({ n: sql<number>`count(*)::int` }).from(adminPasskeys);
  return (row?.n ?? 0) > 0;
}

export interface PasskeySummary {
  id: string;
  label: string;
  synced: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

const summary = (p: AdminPasskey): PasskeySummary => ({
  id: p.id,
  label: p.label,
  synced: p.backedUp,
  createdAt: p.createdAt.toISOString(),
  lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
});

export async function listPasskeys(): Promise<PasskeySummary[]> {
  return (await getDb().select().from(adminPasskeys).orderBy(asc(adminPasskeys.createdAt))).map(summary);
}

export async function removePasskey(id: string): Promise<void> {
  await getDb().delete(adminPasskeys).where(eq(adminPasskeys.id, id));
}

/** The stable WebAuthn user handle (created once), so a device that registers again replaces its old passkey. */
async function userHandle(): Promise<string> {
  const db = getDb();
  const [row] = await db.select({ handle: adminAuth.userHandle }).from(adminAuth).where(eq(adminAuth.id, 1)).limit(1);
  if (row?.handle) return row.handle;
  const handle = isoBase64URL.fromBuffer(randomBytes(32));
  const [saved] = await db
    .insert(adminAuth)
    .values({ id: 1, userHandle: handle })
    .onConflictDoUpdate({ target: adminAuth.id, set: { userHandle: sql`coalesce(${adminAuth.userHandle}, ${handle})`, updatedAt: new Date() } })
    .returning({ handle: adminAuth.userHandle });
  return saved.handle ?? handle;
}

const transportsOf = (value: string | null) => (value ? (value.split(",").filter(Boolean) as AuthenticatorTransport[]) : undefined);

/** Step 1 of "Add Face ID / Touch ID on this device" (owner signed in). */
export async function registrationOptions(req: Request): Promise<PublicKeyCredentialCreationOptionsJSON> {
  if (!(await passkeysReady())) throw unavailable();
  const existing = await getDb().select({ id: adminPasskeys.id, transports: adminPasskeys.transports }).from(adminPasskeys);
  if (existing.length >= MAX_PASSKEYS) throw new PasskeyError(`You can keep up to ${MAX_PASSKEYS} devices. Remove one first.`);
  const { rpID } = relyingParty(req);
  const options = await generateRegistrationOptions({
    rpName: "Tiny Humans",
    rpID,
    userName: "Tiny Humans owner",
    userDisplayName: "Tiny Humans owner",
    userID: isoBase64URL.toBuffer(await userHandle()),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.id, transports: transportsOf(p.transports) })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    supportedAlgorithmIDs: [-7, -257],
    timeout: 120_000,
  });
  await rememberChallenge("register", options.challenge);
  return options;
}

/** Step 2: checks the device's answer and saves its public key. */
export async function completeRegistration(req: Request, response: RegistrationResponseJSON): Promise<PasskeySummary> {
  const challenge = await takeChallenge("register");
  if (!challenge) throw new PasskeyError("That took too long. Please try again.");
  const { rpID, origin } = relyingParty(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  } catch (err) {
    log.warn("admin.passkey", "Registration not verified", { error: err as Error });
    throw new PasskeyError("This device couldn't be added. Please try again.");
  }
  if (!verification.verified) throw new PasskeyError("This device couldn't be added. Please try again.");
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const values = {
    id: credential.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports?.join(",") ?? null,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    label: passkeyLabel(req.headers.get("user-agent")),
  };
  const [saved] = await getDb()
    .insert(adminPasskeys)
    .values(values)
    .onConflictDoUpdate({ target: adminPasskeys.id, set: { ...values, createdAt: new Date(), lastUsedAt: null } })
    .returning();
  return summary(saved);
}

/** Step 1 of "Sign in with Face ID / Touch ID" (no username: the device offers the owner's passkey). */
export async function authenticationOptions(req: Request): Promise<PublicKeyCredentialRequestOptionsJSON> {
  if (!(await hasPasskeys())) throw new PasskeyError("No device is set up for Face ID / Touch ID yet. Sign in with the password.", 404);
  const options = await generateAuthenticationOptions({ rpID: relyingParty(req).rpID, userVerification: "required", timeout: 120_000 });
  await rememberChallenge("login", options.challenge);
  return options;
}

/** Step 2: true when the device proved it holds one of the owner's passkeys (Face ID / Touch ID / PIN used). */
export async function completeAuthentication(req: Request, response: AuthenticationResponseJSON): Promise<boolean> {
  const challenge = await takeChallenge("login");
  if (!challenge || !(await passkeysReady())) return false;
  const [passkey] = await getDb().select().from(adminPasskeys).where(eq(adminPasskeys.id, response.id)).limit(1);
  if (!passkey) return false;
  const { rpID, origin } = relyingParty(req);
  try {
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: passkey.id, publicKey: isoBase64URL.toBuffer(passkey.publicKey), counter: passkey.counter, transports: transportsOf(passkey.transports) },
      requireUserVerification: true,
    });
    if (!verified) return false;
    await getDb()
      .update(adminPasskeys)
      .set({ counter: authenticationInfo.newCounter, backedUp: authenticationInfo.credentialBackedUp, lastUsedAt: new Date() })
      .where(eq(adminPasskeys.id, passkey.id));
    return true;
  } catch (err) {
    log.warn("admin.passkey", "Sign-in not verified", { error: err as Error });
    return false;
  }
}
