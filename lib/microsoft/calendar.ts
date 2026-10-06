import "server-only";
import { graphFetch, GraphError } from "./graph";
import { microsoftConfig } from "./config";

/** A busy period on the Tiny Humans calendar (UTC instants). */
export interface BusyInterval {
  start: Date;
  end: Date;
  /** Outlook event id (lets a reschedule ignore the booking's own event). */
  eventId?: string;
}

interface GraphEvent {
  id: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  showAs?: string;
  isCancelled?: boolean;
}

const user = () => encodeURIComponent(microsoftConfig().calendarUser);

/** Busy periods between two instants (events marked "free" or cancelled are ignored). */
export async function getBusyIntervals(from: Date, to: Date): Promise<BusyInterval[]> {
  const params = new URLSearchParams({
    startDateTime: from.toISOString(),
    endDateTime: to.toISOString(),
    $select: "id,start,end,showAs,isCancelled",
    $top: "250",
  });
  const out: BusyInterval[] = [];
  let next: string | undefined = `/users/${user()}/calendarView?${params}`;
  for (let page = 0; next && page < 10; page++) {
    const res: { value: GraphEvent[]; "@odata.nextLink"?: string } = await graphFetch(next, {
      headers: { Prefer: 'outlook.timezone="UTC"' },
      scope: "graph.calendar",
    });
    for (const e of res.value) {
      if (e.isCancelled || e.showAs === "free") continue;
      out.push({ start: new Date(e.start.dateTime + "Z"), end: new Date(e.end.dateTime + "Z"), eventId: e.id });
    }
    next = res["@odata.nextLink"];
  }
  return out;
}

export interface NewCalendarEvent {
  subject: string;
  bodyHtml: string;
  /** Local wall time "YYYY-MM-DDTHH:MM:00" in `timeZone`. */
  start: string;
  end: string;
  /** Windows time zone ID, e.g. "Eastern Standard Time". */
  timeZone: string;
  location: string;
  /** Makes creation idempotent: retries with the same id won't create a second event. */
  transactionId: string;
}

export async function createCalendarEvent(e: NewCalendarEvent): Promise<{ id: string }> {
  const created = await graphFetch<{ id: string }>(`/users/${user()}/events`, {
    method: "POST",
    scope: "graph.calendar",
    body: JSON.stringify({
      subject: e.subject,
      body: { contentType: "HTML", content: e.bodyHtml },
      start: { dateTime: e.start, timeZone: e.timeZone },
      end: { dateTime: e.end, timeZone: e.timeZone },
      location: { displayName: e.location },
      showAs: "busy",
      categories: ["Tiny Humans"],
      isReminderOn: true,
      reminderMinutesBeforeStart: 120,
      transactionId: e.transactionId,
    }),
  });
  return { id: created.id };
}

export async function moveCalendarEvent(eventId: string, start: string, end: string, timeZone: string): Promise<void> {
  await graphFetch(`/users/${user()}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    scope: "graph.calendar",
    body: JSON.stringify({ start: { dateTime: start, timeZone }, end: { dateTime: end, timeZone } }),
  });
}

/** Deletes the event (treats "already gone" as success). */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    await graphFetch(`/users/${user()}/events/${encodeURIComponent(eventId)}`, { method: "DELETE", scope: "graph.calendar" });
  } catch (err) {
    if (err instanceof GraphError && err.status === 404) return;
    throw err;
  }
}
