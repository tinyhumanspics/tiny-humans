export const BOOKING_LANGUAGE_SWITCH_EVENT = "tiny-humans:booking-language-switch";

const STORAGE_KEY = "th_booking_language_draft";
const MAX_AGE_MS = 2 * 60 * 1000;

interface StoredDraft<T> {
  version: 1;
  savedAt: number;
  targetPath: string;
  bundleId: string;
  payload: T;
}

type DraftStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

/** Keep an in-progress booking in this tab just long enough for a full EN/ES page load. */
export function saveBookingLanguageDraft<T>(storage: DraftStorage, targetPath: string, bundleId: string, payload: T, now = Date.now()): void {
  const draft: StoredDraft<T> = { version: 1, savedAt: now, targetPath, bundleId, payload };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // A blocked/full session store must never prevent the language link from working.
  }
}

/** Read once on the translated booking route, then erase the customer details from browser storage. */
export function consumeBookingLanguageDraft<T>(storage: DraftStorage, targetPath: string, bundleId: string, now = Date.now()): T | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    storage.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as Partial<StoredDraft<T>>;
    if (
      draft.version !== 1
      || typeof draft.savedAt !== "number"
      || now - draft.savedAt < 0
      || now - draft.savedAt > MAX_AGE_MS
      || draft.targetPath !== targetPath
      || draft.bundleId !== bundleId
      || draft.payload === undefined
    ) {
      return null;
    }
    return draft.payload;
  } catch {
    return null;
  }
}
