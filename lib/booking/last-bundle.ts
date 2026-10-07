/**
 * The bundle a family opened the calendar for, remembered for this browser tab's visit only (sessionStorage), so
 * /book without ?bundle= can take them back to it. A later visit starts from the bundles page (current prices).
 * Only the bundle id is stored: no personal data.
 */
const KEY = "th_last_bundle";

export function rememberBundle(id: string): void {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* storage blocked (private mode, in-app browsers): nothing to remember */
  }
}

export function lastBundle(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
