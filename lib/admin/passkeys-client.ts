"use client";

import { browserSupportsWebAuthn, startAuthentication, startRegistration, WebAuthnError } from "@simplewebauthn/browser";

/** Owner area only: Face ID / Touch ID (passkeys) on the sign-in page and in Settings. */

export interface PasskeyDevice {
  id: string;
  label: string;
  synced: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PasskeyList {
  /** false until migration 0020 has run */
  ready: boolean;
  passkeys: PasskeyDevice[];
}

/** error null = the owner cancelled the Face ID / Touch ID prompt (nothing to say). */
export type PasskeyResult = { ok: true } | { ok: false; error: string | null };

/** An error message from our own API (already written for the owner). */
class ApiError extends Error {}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error || "Something went wrong. Please try again.");
  return data as T;
}

const post = (body?: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

function failure(err: unknown): PasskeyResult {
  if (err instanceof ApiError) return { ok: false, error: err.message };
  const name = (err as Error)?.name;
  // Cancelled, timed out, or the prompt was dismissed: no message.
  if (name === "NotAllowedError" || name === "AbortError" || (err instanceof WebAuthnError && err.code === "ERROR_CEREMONY_ABORTED")) return { ok: false, error: null };
  if (err instanceof WebAuthnError && err.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") return { ok: false, error: "This device is already set up." };
  return { ok: false, error: "Face ID / Touch ID didn't work on this device. Please use the password." };
}

export const passkeysSupported = () => typeof window !== "undefined" && browserSupportsWebAuthn();

/** The sign-in page offers Face ID / Touch ID only when this browser can and a device has been set up. */
export async function passkeySignInAvailable(): Promise<boolean> {
  if (!passkeysSupported()) return false;
  try {
    return (await api<{ available: boolean }>("/api/admin/passkeys/available")).available === true;
  } catch {
    return false;
  }
}

export async function signInWithPasskey(): Promise<PasskeyResult> {
  try {
    const optionsJSON = await api<Parameters<typeof startAuthentication>[0]["optionsJSON"]>("/api/admin/passkeys/login/options", post());
    const response = await startAuthentication({ optionsJSON });
    await api("/api/admin/passkeys/login", post({ response }));
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export const listPasskeys = () => api<PasskeyList>("/api/admin/passkeys");

/** "Add Face ID / Touch ID on this device". */
export async function addPasskey(): Promise<PasskeyResult & { list?: PasskeyList }> {
  try {
    const optionsJSON = await api<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/api/admin/passkeys/register/options", post());
    const response = await startRegistration({ optionsJSON });
    const list = await api<PasskeyList>("/api/admin/passkeys/register", post({ response }));
    return { ok: true, list };
  } catch (err) {
    return failure(err);
  }
}

export const removePasskey = (id: string) => api<PasskeyList>(`/api/admin/passkeys?id=${encodeURIComponent(id)}`, { method: "DELETE" });

/** Signs out every other device; this one stays signed in. */
export const signOutOtherDevices = () => api<{ ok: true }>("/api/admin/session/others", post());
