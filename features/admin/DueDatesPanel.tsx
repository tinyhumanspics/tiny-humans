"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminApi, DueList } from "@/lib/admin/client";
import type { DueReservationRow } from "@/lib/due-date/types";
import type { DayAvailability } from "@/lib/booking/types";
import { babyAgeOptions, bookingRules } from "@/config/booking";
import { daysBetweenDateKeys } from "@/lib/validation/date-key";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { todayInZone } from "@/lib/booking/timezone";
import { formatMoney } from "@/lib/pricing/engine";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import AdminDialog from "./AdminDialog";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

type Note = { kind: "ok" | "error"; text: string } | null;
const errText = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
const babies = (n: number) => (n === 1 ? "1 baby" : n === 2 ? "Twins" : "Triplets");

function statusOf(r: DueReservationRow): { label: string; tone: "confirmed" | "pending" | "cancelled" } {
  if (r.status === "scheduled") return { label: r.booking ? `Booked: ${formatLongDate(r.booking.date)} at ${formatTimeLabel(r.booking.start)}` : "Booked", tone: "confirmed" };
  if (r.status === "reserved" || r.status === "scheduling") return { label: "Waiting for baby", tone: "pending" };
  if (r.status === "pending") return { label: "Deposit page open (not paid yet)", tone: "pending" };
  if (r.status === "expired") return { label: "Not finished (deposit not paid)", tone: "cancelled" };
  return { label: "Cancelled", tone: "cancelled" };
}

function depositOf(r: DueReservationRow): string {
  const amount = formatMoney(r.depositCents);
  if (r.depositStatus === "paid") return `${amount} paid`;
  if (r.depositStatus === "refunded") return `${amount} refunded`;
  if (r.depositStatus === "unpaid") return `${amount} NOT paid (Stripe was down): send the payment link after booking`;
  if (r.depositStatus === "pending") return `${amount} not paid yet`;
  if (r.depositStatus === "expired") return `${amount} never paid`;
  return "No deposit (deposits were off)";
}

/**
 * /admin → Leads → Due dates ("Not born yet", owner Nov 10): families who reserved with their due date. When the baby
 * arrives they pick their session with the link in their email, or text the studio and the owner books it here
 * ("Book their session": a normal booking, kept price, no new deposit, the usual confirmation email).
 */
export default function DueDatesPanel({ api, onCount }: { api: AdminApi; onCount?: (waiting: number) => void }) {
  const [data, setData] = useState<DueList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [cancel, setCancel] = useState<DueReservationRow | null>(null);
  const [refund, setRefund] = useState(true);
  const [busy, setBusy] = useState(false);
  const today = todayInZone(bookingRules.timeZone);

  const show = useCallback(
    (list: DueList) => {
      setData(list);
      onCount?.(list.reservations.filter((r) => r.status === "reserved" || r.status === "scheduling").length);
    },
    [onCount],
  );
  useEffect(() => {
    api.listDueDates().then(show).catch((e) => setError(errText(e, "Couldn't load the due dates.")));
  }, [api, show]);

  const copy = async (r: DueReservationRow) => {
    if (!r.scheduleUrl) return;
    try {
      await navigator.clipboard.writeText(r.scheduleUrl);
      setNote({ kind: "ok", text: `${r.parentName.split(" ")[0]}'s link is copied: paste it in a text and they pick their session (no payment).` });
    } catch {
      setNote({ kind: "error", text: r.scheduleUrl });
    }
  };

  const doCancel = async () => {
    if (!cancel) return;
    setBusy(true);
    try {
      const r = await api.cancelDueDate(cancel.id, refund && cancel.depositStatus === "paid");
      show(r);
      setNote(r.refundError ? { kind: "error", text: `Reservation cancelled. ${r.refundError}` } : { kind: "ok", text: `Reservation cancelled${r.refunded ? ` and the ${formatMoney(cancel.depositCents)} deposit refunded` : ""}.` });
      setCancel(null);
    } catch (e) {
      setNote({ kind: "error", text: errText(e, "Couldn't cancel.") });
    } finally {
      setBusy(false);
    }
  };

  const waiting = data?.reservations.filter((r) => r.status === "reserved" || r.status === "scheduling") ?? [];
  const others = data?.reservations.filter((r) => !(r.status === "reserved" || r.status === "scheduling")) ?? [];
  return (
    <div aria-label="Due dates">
      <p className={cn(styles.muted, "chalk-soft")}>
        Families who booked with their due date (&ldquo;Not born yet?&rdquo;). Nothing is on the calendar yet. When the baby arrives they pick their session with the link in
        their email, or they text you and you book it here. Their price is kept and their deposit already counts, so they pay nothing more to book.
      </p>
      {error && <p className={cn(styles.bannerError, "chalk-soft")} role="alert">{error}</p>}
      {data && !data.ready && <p className={cn(styles.bannerError, "chalk-soft")} role="alert">{data.error}</p>}
      {note && <p className={cn(note.kind === "ok" ? styles.ok : styles.error, "chalk-soft")} role={note.kind === "error" ? "alert" : "status"}>{note.text}</p>}
      {data?.ready && !data.reservations.length && <p className={cn(styles.hintSmall, "chalk-soft")}>No due-date reservations yet.</p>}

      <ul className={styles.leadList}>
        {[...waiting, ...others].map((r) => {
          const s = statusOf(r);
          const days = daysBetweenDateKeys(today, r.dueDate) ?? 0;
          const isOpen = open === r.id;
          return (
            <li key={r.id} className={styles.leadCard}>
              <button type="button" className={cn(styles.leadHead, styles.dueHead)} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>
                <span>
                  <span className={cn(styles.leadName, "chalk-soft")}>{r.parentName}</span>
                  <span className={cn(styles.leadMeta, styles.dueMeta, "chalk-soft")}>
                    Due {formatLongDate(r.dueDate)}{r.status === "reserved" ? ` (${days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : days === 0 ? "today" : `${-days} day${days === -1 ? "" : "s"} ago`})` : ""} · {r.bundleName} · {babies(r.babyCount)}
                  </span>
                </span>
                <span className={cn(styles.statusPill, styles[`status_${s.tone}`])}>{s.label}</span>
              </button>
              {isOpen && (
                <div className={styles.leadDetails}>
                  <dl>
                    {(
                      [
                        ["Reservation", r.reference],
                        ["Price kept", r.bundlePriceCents < r.regularPriceCents ? `${formatMoney(r.bundlePriceCents)} (${r.offerLabel ?? "offer"}, regular ${formatMoney(r.regularPriceCents)})` : formatMoney(r.bundlePriceCents)],
                        ["Deposit", depositOf(r)],
                        ["Email", r.email],
                        ["Phone", r.phone],
                        ["Home", r.address],
                        ["Travel (estimate)", r.travelFeeCents === null ? "Travel fees off" : r.travelFeeCents ? `${formatMoney(r.travelFeeCents)} (about ${r.travelMiles} miles)` : "No fee"],
                        ["Language", r.locale === "es" ? "Spanish" : "English"],
                        ...(r.notes ? [["Notes", r.notes]] : []),
                        ["Reserved", new Date(r.createdAt).toLocaleDateString()],
                        ...(r.booking ? [["Booking", `${r.booking.reference}: ${formatLongDate(r.booking.date)} at ${formatTimeLabel(r.booking.start)} (in All leads)`]] : []),
                      ] as [string, string][]
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className="chalk-soft">{k}</dt>
                        <dd className="chalk-soft">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {r.status === "reserved" && (
                    <>
                      <BookSession api={api} row={r} today={today} onBooked={(list, ref) => (show(list), setOpen(null), setNote({ kind: "ok", text: `Booked (${ref}). ${r.parentName.split(" ")[0]} got the confirmation email. It's in All leads now.` }))} />
                      <div className={styles.editorActions}>
                        <button type="button" className={styles.smallButton} onClick={() => copy(r)} disabled={!r.scheduleUrl}>Copy their booking link</button>
                        <a className={styles.smallButton} href={`sms:${r.phone.replace(/[^\d+]/g, "")}`}>Text {r.parentName.split(" ")[0]}</a>
                        <button type="button" className={cn(styles.smallButton, styles.danger)} onClick={() => (setRefund(true), setCancel(r))}>Cancel reservation</button>
                      </div>
                    </>
                  )}
                  {(r.status === "pending" || r.status === "expired") && (
                    <div className={styles.editorActions}>
                      <button type="button" className={cn(styles.smallButton, styles.danger)} onClick={() => (setRefund(false), setCancel(r))}>Cancel reservation</button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {cancel && (
        <AdminDialog labelledBy="due-cancel-t" onClose={() => setCancel(null)}>
          <h3 id="due-cancel-t" className={cn(styles.h3, "chalk")}>Cancel {cancel.parentName}&apos;s reservation?</h3>
          <p className={cn(styles.muted, "chalk-soft")}>Their booking link stops working. No email is sent: let them know yourself.</p>
          {cancel.depositStatus === "paid" && (
            <label className={styles.toggle}>
              <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
              <span className="chalk-soft">Refund the {formatMoney(cancel.depositCents)} deposit on Stripe</span>
            </label>
          )}
          <div className={styles.photoBar}>
            <button type="button" className={styles.smallButton} onClick={() => setCancel(null)}>Keep it</button>
            <button type="button" className={cn(styles.smallButton, styles.deleteBtn)} onClick={doCancel} disabled={busy}>{busy ? "Cancelling…" : "Cancel reservation"}</button>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}

/** The owner books the session for a reservation: a day, an open time (same rules as the website), the baby's age. */
function BookSession({ api, row, today, onBooked }: { api: AdminApi; row: DueReservationRow; today: string; onBooked: (list: DueList, reference: string) => void }) {
  const [openForm, setOpenForm] = useState(false);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [start, setStart] = useState("");
  const [age, setAge] = useState<string>(babyAgeOptions[0]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    let live = true;
    fetch(`/api/booking/availability?${new URLSearchParams({ bundle: row.bundleId, babies: String(row.babyCount), from: date, to: date })}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load open times."))))
      .then((j: { days: DayAvailability[] }) => live && setSlots(j.days.find((d) => d.date === date)?.slots.map((s) => s.start) ?? []))
      .catch((e) => live && (setSlots([]), setErr(errText(e, "Couldn't load open times."))));
    return () => {
      live = false;
    };
  }, [date, row.bundleId, row.babyCount]);

  const book = async () => {
    if (!date || !start) return setErr("Pick a day and an open time.");
    setBusy(true);
    setErr(null);
    try {
      const r = await api.bookDueDate({ id: row.id, date, start, babyAge: age, babyName: name.trim() || undefined });
      onBooked(r, r.booked);
    } catch (e) {
      setErr(errText(e, "Couldn't book it."));
    } finally {
      setBusy(false);
    }
  };

  if (!openForm) return <ChalkButton variant="solid" onClick={() => setOpenForm(true)} seed={971}>Book their session</ChalkButton>;
  return (
    <div className={styles.editorBox} role="group" aria-label={`Book ${row.parentName}'s session`}>
      <h4 className={cn(styles.h3, "chalk")}>Book {row.parentName.split(" ")[0]}&apos;s session</h4>
      <div className={styles.editorGrid}>
        <label className={cn(styles.label, "chalk-soft")}>Day<input className={cn(styles.input, styles.timeInput)} type="date" min={today} value={date} onChange={(e) => (setDate(e.target.value), setSlots(null), setStart(""), setErr(null))} /></label>
        <label className={cn(styles.label, "chalk-soft")}>Baby&apos;s age<select className={styles.input} value={age} onChange={(e) => setAge(e.target.value)}>{babyAgeOptions.filter((o) => o !== "Not born yet").map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
        <label className={cn(styles.label, "chalk-soft")}>Baby&apos;s name (optional)<input className={styles.input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
      </div>
      {date && (
        <div role="group" aria-label="Open times">
          {slots === null ? (
            <p className={cn(styles.hintSmall, "chalk-soft")}>Loading open times…</p>
          ) : slots.length ? (
            <div className={styles.checkGrid}>
              {slots.map((s) => (
                <button key={s} type="button" className={cn(styles.smallButton, start === s && styles.smallButtonOn)} aria-pressed={start === s} onClick={() => setStart(s)}>{formatTimeLabel(s)}</button>
              ))}
            </div>
          ) : (
            <p className={cn(styles.hintSmall, "chalk-soft")}>No open times that day (hours, blocks, Outlook or other bookings). Try another day.</p>
          )}
        </div>
      )}
      <p className={cn(styles.hintSmall, "chalk-soft")}>The same open times as the website. {row.parentName.split(" ")[0]} gets the usual confirmation email, with their kept price and their deposit already counted.</p>
      {err && <p className={cn(styles.error, "chalk-soft")} role="alert">{err}</p>}
      <div className={styles.editorActions}>
        <button type="button" className={styles.smallButton} onClick={() => setOpenForm(false)}>Not now</button>
        <ChalkButton variant="solid" onClick={book} disabled={busy || !start} seed={972}>{busy ? "Booking…" : "Book it"}</ChalkButton>
      </div>
    </div>
  );
}
