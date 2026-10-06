"use client";

import { defaultSettings, parseSettings } from "@/lib/settings/defaults";
import type { SiteSettings } from "@/lib/settings/types";
import type { AvailabilityRules, BookingLimits, DateOverride, TimeBlock, WeeklyDay } from "@/lib/availability/types";
import { blockSchema, overrideSchema, weeklyAndLimitsSchema } from "@/lib/availability/validation";
import { readPrototypeAvailability, writePrototypeAvailability } from "@/lib/availability/prototype";

/** What the owner area needs. Live site: HTTP API. Prototype: this browser only. */
export interface AdminApi {
  mode: "live" | "prototype";
  session(): Promise<{ authenticated: boolean; authConfigured: boolean; storageConfigured: boolean }>;
  login(password: string): Promise<{ ok: boolean; error?: string }>;
  logout(): Promise<void>;
  getSettings(): Promise<SiteSettings>;
  saveSettings(settings: SiteSettings): Promise<SiteSettings>;
  uploadPhoto(file: Blob): Promise<{ src: string }>;
  /* availability (owner only) */
  getAvailability(): Promise<{ rules: AvailabilityRules; databaseConfigured: boolean }>;
  saveWeekly(weekly: WeeklyDay[], limits: BookingLimits): Promise<AvailabilityRules>;
  saveOverride(o: DateOverride): Promise<AvailabilityRules>;
  deleteOverride(date: string): Promise<AvailabilityRules>;
  addBlock(b: Omit<TimeBlock, "id">): Promise<AvailabilityRules>;
  deleteBlock(id: string): Promise<AvailabilityRules>;
}

export const IS_PROTOTYPE = process.env.NEXT_PUBLIC_PROTOTYPE === "1";
export const PROTOTYPE_PASSWORD = "tinyhumans";
export const PROTOTYPE_STORAGE_KEY = "tinyhumans:prototype-settings";

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong. Try again.");
  return data as T;
}

const httpApi: AdminApi = {
  mode: "live",
  session: async () => json(await fetch("/api/admin/session", { cache: "no-store" })),
  login: async (password) => {
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data as { error?: string }).error };
  },
  logout: async () => {
    await fetch("/api/admin/logout", { method: "POST" });
  },
  getSettings: async () => parseSettings(await json(await fetch("/api/admin/settings", { cache: "no-store" }))),
  saveSettings: async (s) =>
    parseSettings(await json(await fetch("/api/admin/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) }))),
  uploadPhoto: async (file) => {
    const form = new FormData();
    form.append("file", file, "photo.jpg");
    return json(await fetch("/api/admin/photos", { method: "POST", body: form }));
  },
  getAvailability: async () => json(await fetch("/api/admin/availability", { cache: "no-store" })),
  saveWeekly: async (weekly, limits) =>
    (await json<{ rules: AvailabilityRules }>(await fetch("/api/admin/availability", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekly, limits }) }))).rules,
  saveOverride: async (o) =>
    (await json<{ rules: AvailabilityRules }>(await fetch("/api/admin/availability/overrides", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(o) }))).rules,
  deleteOverride: async (date) => (await json<{ rules: AvailabilityRules }>(await fetch(`/api/admin/availability/overrides?date=${date}`, { method: "DELETE" }))).rules,
  addBlock: async (b) =>
    (await json<{ rules: AvailabilityRules }>(await fetch("/api/admin/availability/blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }))).rules,
  deleteBlock: async (id) => (await json<{ rules: AvailabilityRules }>(await fetch(`/api/admin/availability/blocks?id=${id}`, { method: "DELETE" }))).rules,
};

/** Prototype: validate like the server, then keep the rules in this browser. */
function protoSave(update: (r: AvailabilityRules) => AvailabilityRules): AvailabilityRules {
  const next = update(readPrototypeAvailability());
  next.overrides.sort((a, b) => a.date.localeCompare(b.date));
  next.blocks.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  writePrototypeAvailability(next);
  return next;
}
const firstIssue = (r: { success: boolean; error?: { issues: { message: string }[] } }) => {
  if (!r.success) throw new Error(r.error?.issues[0]?.message ?? "Check the details and try again.");
};

export function readPrototypeSettings(): SiteSettings | null {
  try {
    const raw = window.localStorage.getItem(PROTOTYPE_STORAGE_KEY);
    return raw ? parseSettings(JSON.parse(raw), { allowDataUrls: true }) : null;
  } catch {
    return null;
  }
}

const prototypeApi: AdminApi = {
  mode: "prototype",
  session: async () => ({
    authenticated: (() => {
      try {
        return window.sessionStorage.getItem("tinyhumans:owner") === "1";
      } catch {
        return false;
      }
    })(),
    authConfigured: true,
    storageConfigured: true,
  }),
  login: async (password) => {
    await new Promise((r) => setTimeout(r, 300));
    if (password !== PROTOTYPE_PASSWORD) return { ok: false, error: "That password isn't right." };
    try {
      window.sessionStorage.setItem("tinyhumans:owner", "1");
    } catch {}
    return { ok: true };
  },
  logout: async () => {
    try {
      window.sessionStorage.removeItem("tinyhumans:owner");
    } catch {}
  },
  getSettings: async () => readPrototypeSettings() ?? defaultSettings,
  saveSettings: async (s) => {
    const saved = { ...parseSettings(s, { allowDataUrls: true }), updatedAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(PROTOTYPE_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      throw new Error("This browser ran out of preview storage. Use fewer or smaller photos in the prototype.");
    }
    return saved;
  },
  uploadPhoto: async (file) => {
    const src = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Couldn't read that photo."));
      r.readAsDataURL(file);
    });
    return { src };
  },
  getAvailability: async () => ({ rules: readPrototypeAvailability(), databaseConfigured: true }),
  saveWeekly: async (weekly, limits) => {
    firstIssue(weeklyAndLimitsSchema.safeParse({ weekly, limits }));
    return protoSave((r) => ({ ...r, weekly, limits }));
  },
  saveOverride: async (o) => {
    firstIssue(overrideSchema.safeParse(o));
    const clean: DateOverride = o.isClosed ? { date: o.date, isClosed: true } : o;
    return protoSave((r) => ({ ...r, overrides: [...r.overrides.filter((x) => x.date !== o.date), clean] }));
  },
  deleteOverride: async (date) => protoSave((r) => ({ ...r, overrides: r.overrides.filter((x) => x.date !== date) })),
  addBlock: async (b) => {
    firstIssue(blockSchema.safeParse(b));
    return protoSave((r) => ({ ...r, blocks: [...r.blocks, { ...b, id: `blk-${Math.random().toString(36).slice(2, 10)}` }] }));
  },
  deleteBlock: async (id) => protoSave((r) => ({ ...r, blocks: r.blocks.filter((x) => x.id !== id) })),
};

export function getAdminApi(): AdminApi {
  return IS_PROTOTYPE ? prototypeApi : httpApi;
}

/** Shrink a photo in the browser before upload (max 2000px, JPEG). */
export async function preparePhoto(file: File, maxSide = 2000, quality = 0.86): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`"${file.name}" isn't a photo this browser can open.`));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process that photo."))), "image/jpeg", quality));
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
