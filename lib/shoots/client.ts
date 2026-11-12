import type { Player } from "./players";
import type { BringSection, DaySheet, InspoGroup, InspoItem, ShootDay, ShootDetail } from "./types";

/** Browser calls for /admin → Shoots (owner only; the routes check the session). */

export class ShootsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** True until migration 0024 has run: the page shows "Run the shoots migration". */
    readonly notReady = false,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init, headers: typeof init?.body === "string" ? { "content-type": "application/json", ...init.headers } : init?.headers });
  } catch {
    throw new ShootsApiError("No connection. Check the internet and try again.", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string; notReady?: boolean };
  if (!res.ok) throw new ShootsApiError(data.error || "Something went wrong. Try again.", res.status, Boolean(data.notReady));
  return data as T;
}

const body = (value: unknown) => JSON.stringify(value);

export const shootsApi = {
  days: async (from: string, to: string) => (await call<{ days: ShootDay[] }>(`/api/admin/shoots?${new URLSearchParams({ from, to })}`)).days,
  createStyled: async (input: { title: string; date: string; startTime: string | null; place: string | null }) =>
    (await call<{ shoot: ShootDetail }>("/api/admin/shoots", { method: "POST", body: body(input) })).shoot,

  shoot: async (key: string) => (await call<{ shoot: ShootDetail }>(`/api/admin/shoots/${key}`)).shoot,
  saveShoot: async (key: string, patch: { said?: string; confirm?: string; bringExtra?: string }) =>
    (await call<{ shoot: ShootDetail }>(`/api/admin/shoots/${key}`, { method: "PATCH", body: body(patch) })).shoot,
  deleteShoot: (key: string) => call<void>(`/api/admin/shoots/${key}`, { method: "DELETE" }),
  addLink: async (key: string, group: InspoGroup, url: string) =>
    (await call<{ item: InspoItem }>(`/api/admin/shoots/${key}/inspo`, { method: "POST", body: body({ type: "link", group, url }) })).item,
  addNote: async (key: string, group: InspoGroup) =>
    (await call<{ item: InspoItem }>(`/api/admin/shoots/${key}/inspo`, { method: "POST", body: body({ type: "note", group, caption: "" }) })).item,
  saveCaption: async (key: string, id: string, caption: string) =>
    (await call<{ item: InspoItem }>(`/api/admin/shoots/${key}/inspo/${id}`, { method: "PATCH", body: body({ caption }) })).item,
  saveWho: async (key: string, id: string, who: string[]) =>
    (await call<{ item: InspoItem }>(`/api/admin/shoots/${key}/inspo/${id}`, { method: "PATCH", body: body({ who }) })).item,
  removeInspo: (key: string, id: string) => call<void>(`/api/admin/shoots/${key}/inspo/${id}`, { method: "DELETE" }),
  /** One photo, already shrunk in the browser (preparePhoto). */
  uploadPhoto: async (key: string, group: InspoGroup, photo: { blob: Blob; width: number; height: number }) => {
    const form = new FormData();
    form.append("file", photo.blob, "photo.jpg");
    form.append("group", group);
    form.append("width", String(photo.width));
    form.append("height", String(photo.height));
    return (await call<{ item: InspoItem }>(`/api/admin/shoots/${key}/inspo/photo`, { method: "POST", body: form })).item;
  },

  /** A short share link's player (the server follows its redirect); null = open it in the app instead. */
  player: async (link: string) => (await call<{ player: Player | null }>(`/api/admin/shoots/player?${new URLSearchParams({ link })}`)).player,

  day: async (date: string) => (await call<{ day: DaySheet }>(`/api/admin/shoots/day/${date}`)).day,
  tick: (date: string, key: string, on: boolean) => call<void>("/api/admin/shoots/ticks", { method: "POST", body: body({ date, key, on }) }),
  clearTicks: (date: string) => call<void>(`/api/admin/shoots/ticks?${new URLSearchParams({ date })}`, { method: "DELETE" }),

  bring: async () => (await call<{ sections: BringSection[] }>("/api/admin/shoots/bring")).sections,
  addSection: async (name = "") => (await call<{ section: BringSection }>("/api/admin/shoots/bring", { method: "POST", body: body({ name }) })).section,
  saveSection: async (id: string, patch: { name?: string; items?: string; sort?: number }) =>
    (await call<{ section: BringSection }>(`/api/admin/shoots/bring/${id}`, { method: "PATCH", body: body(patch) })).section,
  removeSection: (id: string) => call<void>(`/api/admin/shoots/bring/${id}`, { method: "DELETE" }),
};
