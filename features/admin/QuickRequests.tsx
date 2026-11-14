"use client";

import { useEffect, useState } from "react";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import { site } from "@/config/site";
import type { AdminApi } from "@/lib/admin/client";
import { formatLongDate } from "@/lib/booking/dates";
import { cn } from "@/lib/cn";
import type { QuickRequest } from "@/lib/quick/types";
import AdminDialog from "./AdminDialog";
import { smsHref, telHref } from "./contact-links";
import type { OwnerPrefill } from "./OwnerBookingForm";
import styles from "./Admin.module.css";

const when = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
const errText = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
const base = site.url.replace(/\/$/, "");
const LINKS = { en: `${base}/quick`, es: `${base}/es/quick` } as const;

/** What the family sent, as the booking form's starting values (the notes keep their best times, due date and message). */
export function prefillOf(r: QuickRequest): OwnerPrefill {
  const notes = [r.bestTime && `Best times: ${r.bestTime}`, r.dueDate && `Due date: ${formatLongDate(r.dueDate)}`, r.message].filter(Boolean).join("\n");
  return { requestId: r.id, parentName: r.parentName, email: r.email, phone: r.phone, zip: r.zip, babyName: r.babyName, babyAge: r.babyAge === "Not born yet" ? null : r.babyAge, bundleId: r.bundleId, notes, locale: r.locale };
}

/**
 * /admin → Quotes / Booking (owner, Nov 13): the quick form's link to send families, and what they sent. "Book it for
 * them" fills in the booking form below with their details; once booked, the request shows the booking's reference.
 */
export default function QuickRequests({ api, reload, onBook }: { api: AdminApi; reload: number; onBook: (prefill: OwnerPrefill) => void }) {
  const [data, setData] = useState<{ requests: QuickRequest[]; notReady?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const [copied, setCopied] = useState<"en" | "es" | null>(null);
  const [confirm, setConfirm] = useState<QuickRequest | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .listQuick()
      .then((d) => live && (setData(d), setError(null)))
      .catch((e) => live && setError(errText(e, "Couldn't load the quick form's requests.")));
    return () => {
      live = false;
    };
  }, [api, reload, tick]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      setTick((n) => n + 1);
    } catch (e) {
      setError(errText(e, "Couldn't save that. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const copy = async (lang: "en" | "es") => {
    try {
      await navigator.clipboard.writeText(LINKS[lang]);
      setCopied(lang);
    } catch {
      setError("Couldn't copy. Select the link and copy it yourself.");
    }
  };

  const requests = data?.requests ?? [];
  const open = requests.filter((r) => r.status === "new");
  const finished = requests.filter((r) => r.status !== "new");

  return (
    <section className={styles.section} aria-labelledby="quick-requests-title">
      <h2 id="quick-requests-title" className={cn(styles.h2, "chalk")}>Quick form{open.length ? ` · ${open.length} new` : ""}</h2>
      <p className={cn(styles.muted, "chalk-soft")}>
        For families who&apos;d rather you book it for them: send them this link. They fill in their name, phone, email and ZIP code (baby, bundle and best times
        are optional), you get an email, and it shows up here. Text them to pick the day, then press “Book it for them”.
      </p>
      <div className={styles.availBlock}>
        <p className={cn(styles.leadLine, "chalk-soft")}><b>{LINKS.en}</b></p>
        <div className={styles.editorActions}>
          <ChalkButton variant="solid" onClick={() => copy("en")} seed={981}>{copied === "en" ? "Link copied ✓" : "Copy the link"}</ChalkButton>
          <ChalkButton variant="outline" onClick={() => copy("es")} seed={982}>{copied === "es" ? "Spanish link copied ✓" : "Copy the Spanish link"}</ChalkButton>
        </div>
        <p className={cn(styles.hintSmall, "chalk-soft")}>The Spanish link works while Spanish is on (Settings). Add ?bundle=our-little-story to the link to pick a bundle for them.</p>
      </div>

      {data?.notReady && <p className={cn(styles.banner, "chalk-soft")} role="status">{data.notReady}</p>}
      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
      {data && !data.notReady && requests.length === 0 && <p className={cn(styles.muted, "chalk-soft")}>No requests yet.</p>}

      {open.length > 0 && (
        <ul className={styles.leadList} aria-label="New quick form requests">
          {open.map((r) => <Request key={r.id} r={r} busy={busy} onBook={() => onBook(prefillOf(r))} onStatus={(s) => run(`status-${r.id}`, () => api.setQuickStatus(r.id, s))} onDelete={() => setConfirm(r)} />)}
        </ul>
      )}
      {finished.length > 0 && (
        <>
          <button type="button" className={cn(styles.linkButton, "chalk-soft")} aria-expanded={showFinished} onClick={() => setShowFinished((v) => !v)}>
            {showFinished ? "Hide booked and done" : `Show booked and done (${finished.length})`}
          </button>
          {showFinished && (
            <ul className={styles.leadList} aria-label="Booked and done quick form requests">
              {finished.map((r) => <Request key={r.id} r={r} busy={busy} onBook={() => onBook(prefillOf(r))} onStatus={(s) => run(`status-${r.id}`, () => api.setQuickStatus(r.id, s))} onDelete={() => setConfirm(r)} />)}
            </ul>
          )}
        </>
      )}

      {confirm && (
        <AdminDialog labelledBy="quick-confirm-t" describedBy="quick-confirm-d" onClose={() => setConfirm(null)}>
          <h3 id="quick-confirm-t" className={cn(styles.h3, "chalk")}>{`Delete ${confirm.parentName}'s request?`}</h3>
          <p id="quick-confirm-d" className={cn(styles.muted, "chalk-soft")}>What they sent is deleted from this list (a booking made from it stays in Leads). Use it for tests, spam, or when a family asks.</p>
          <div className={styles.photoBar}>
            <button type="button" className={styles.smallButton} onClick={() => setConfirm(null)}>Cancel</button>
            <button
              type="button"
              className={cn(styles.smallButton, styles.danger)}
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                run(`delete-${c.id}`, () => api.deleteQuick(c.id));
              }}
            >
              Delete
            </button>
          </div>
        </AdminDialog>
      )}
    </section>
  );
}

function Request({ r, busy, onBook, onStatus, onDelete }: { r: QuickRequest; busy: string | null; onBook: () => void; onStatus: (s: QuickRequest["status"]) => void; onDelete: () => void }) {
  const baby = [r.babyName, r.babyAge === "Not born yet" ? (r.dueDate ? `due ${formatLongDate(r.dueDate)}` : "not born yet") : r.babyAge].filter(Boolean).join(" · ");
  return (
    <li className={styles.leadCard}>
      <div className={styles.leadHead}>
        <span className={cn(styles.leadName, "chalk-soft")}>{r.parentName}</span>
        <span className={styles.leadPills}>
          {r.status === "new" ? <span className={styles.statusPill}>New</span> : r.status === "booked" ? <span className={cn(styles.statusPill, styles.paidPill)}>{`Booked${r.bookingReference ? ` ${r.bookingReference}` : ""}`}</span> : <span className={styles.statusPill}>Done</span>}
        </span>
      </div>
      <p className={cn(styles.leadLine, "chalk-soft")}>
        <b>{r.bundleName ?? "No bundle picked"}</b>
        {` · ZIP ${r.zip}`}
        {baby ? ` · Baby: ${baby}` : ""}
      </p>
      <p className={cn(styles.leadMeta, "chalk-soft")}>{`${r.email} · ${r.phone} · ${r.locale === "es" ? "Spanish" : "English"} · sent ${when(r.createdAt)}`}</p>
      {r.bestTime && <p className={cn(styles.leadMeta, "chalk-soft")}>{`Best times: ${r.bestTime}`}</p>}
      {r.message && <p className={cn(styles.leadLine, "chalk-soft")}>{`“${r.message}”`}</p>}
      <p className={styles.contactActions}>
        <a className={styles.smallButton} href={telHref(r.phone)} aria-label={`Call ${r.parentName}`}>Call</a>
        <a className={styles.smallButton} href={smsHref(r.phone, "")} aria-label={`Text ${r.parentName}`}>Text</a>
        <a className={styles.smallButton} href={`mailto:${r.email}`} aria-label={`Email ${r.parentName}`}>Email</a>
      </p>
      <div className={styles.photoBar}>
        {r.status === "new" && (
          <button type="button" className={styles.smallButton} disabled={busy !== null} onClick={onBook}>Book it for them</button>
        )}
        {r.status === "new" ? (
          <button type="button" className={styles.smallButton} disabled={busy !== null} onClick={() => onStatus("done")}>{busy === `status-${r.id}` ? "Saving…" : "Mark done"}</button>
        ) : (
          <button type="button" className={styles.smallButton} disabled={busy !== null} onClick={() => onStatus("new")}>{busy === `status-${r.id}` ? "Saving…" : "Move back to new"}</button>
        )}
        <button type="button" className={cn(styles.smallButton, styles.danger)} disabled={busy !== null} onClick={onDelete}>{busy === `delete-${r.id}` ? "Deleting…" : "Delete"}</button>
      </div>
    </li>
  );
}
