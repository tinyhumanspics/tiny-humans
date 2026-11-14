import { REQUEST_HOLD_HOURS } from "./types";

/** Hold logic (brief 02): a "Baby is here" request keeps its time 12 h while it's "new"; it lapses by itself. Pure. */

export const holdUntil = (createdAt: Date) => new Date(createdAt.getTime() + REQUEST_HOLD_HOURS * 3_600_000);

export interface HoldRow {
  type: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  holdUntil: Date | null;
}

/** True while this request still keeps its time from other families. */
export function isHeld(r: HoldRow, now: Date): boolean {
  return r.type === "date" && r.status === "new" && Boolean(r.startsAt && r.endsAt && r.holdUntil && r.holdUntil > now);
}

/** The held times, as busy intervals for availability. */
export function heldIntervals(rows: HoldRow[], now: Date): { start: Date; end: Date }[] {
  return rows.filter((r) => isHeld(r, now)).map((r) => ({ start: r.startsAt!, end: r.endsAt! }));
}
