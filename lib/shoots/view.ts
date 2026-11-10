import { autoConfirmOf, bookingKeyOf, bundleLine, inspoTitleOf, whoLineOf } from "./from-bookings";
import type { InspoItem, ShootBookingFacts, ShootDetail, ShootSummary } from "./types";

/** The owners' saved notes for a shoot (a `shoots` row); null fields fall back to the booking. */
export interface ShootRow {
  id: string;
  kind: "booking" | "styled";
  date: string | null;
  startTime: string | null;
  place: string | null;
  title: string | null;
  tabLabel: string | null;
  said: string | null;
  confirm: string[];
  bringExtra: string[];
}

const orDefault = (value: string | null | undefined, fallback: string) => (value?.trim() ? value.trim() : fallback);

/**
 * A booking shoot (facts + its row once edited) or a shoot without a booking (row only) → its folder/day-sheet view.
 * Date and time always come from the booking, so a reschedule moves the shoot.
 */
export function shootDetail(facts: ShootBookingFacts | null, row: ShootRow | null, inspo: InspoItem[]): ShootDetail {
  if (!facts && !row) throw new Error("shootDetail needs a booking or a row");
  const sorted = [...inspo].sort((a, b) => (a.group === b.group ? a.sort - b.sort : a.group === "inspo" ? -1 : 1));
  const counts = { inspoCount: sorted.filter((i) => i.group === "inspo").length, btsCount: sorted.filter((i) => i.group === "bts").length };
  const confirm = row?.confirm ?? [];
  const bringExtra = row?.bringExtra ?? [];
  if (facts) {
    const said = row?.said ?? null;
    return {
      key: bookingKeyOf(facts.reference),
      id: row?.id ?? null,
      kind: "booking",
      date: facts.date,
      start: facts.start,
      end: facts.end,
      title: orDefault(row?.title, facts.defaultTitle),
      tabLabel: orDefault(row?.tabLabel, facts.defaultTabLabel),
      bundleLine: bundleLine(facts),
      bundleName: facts.bundleName,
      place: facts.city || null,
      status: facts.status,
      ...counts,
      booking: facts,
      inspoTitle: inspoTitleOf(facts),
      whoLine: whoLineOf(facts),
      said: said ?? facts.notes ?? "",
      saidFromBooking: said === null,
      confirm,
      autoConfirm: autoConfirmOf(facts),
      bringExtra,
      inspo: sorted,
    };
  }
  const r = row!;
  const title = orDefault(r.title, "Shoot without a booking");
  return {
    key: r.id,
    id: r.id,
    kind: "styled",
    date: r.date ?? "",
    start: r.startTime,
    end: null,
    title,
    tabLabel: orDefault(r.tabLabel, title),
    bundleLine: null,
    bundleName: null,
    place: r.place?.trim() || null,
    status: null,
    ...counts,
    booking: null,
    inspoTitle: inspoTitleOf(null),
    whoLine: whoLineOf(null),
    said: r.said ?? "",
    saidFromBooking: false,
    confirm,
    autoConfirm: [],
    bringExtra,
    inspo: sorted,
  };
}

/** The list/day-card version (no inspo, notes or booking facts). */
export function shootSummary(d: ShootDetail): ShootSummary {
  return {
    key: d.key,
    id: d.id,
    kind: d.kind,
    date: d.date,
    start: d.start,
    end: d.end,
    title: d.title,
    tabLabel: d.tabLabel,
    bundleLine: d.bundleLine,
    bundleName: d.bundleName,
    place: d.place,
    inspoCount: d.inspoCount,
    btsCount: d.btsCount,
    status: d.status,
  };
}

/** Shoots of a day in order: by start time (shoots without one last), then title. */
export const byStart = (a: Pick<ShootSummary, "start" | "title">, b: Pick<ShootSummary, "start" | "title">) =>
  (a.start ?? "99:99").localeCompare(b.start ?? "99:99") || a.title.localeCompare(b.title);
