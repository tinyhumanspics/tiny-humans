"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { waiverApi, WaiverApiError } from "@/lib/waiver/client";
import { usesSummary } from "@/lib/waiver/text";
import type { SignedWaiver } from "@/lib/waiver/types";
import WaiverPaper, { Mark } from "./WaiverPaper";
import css from "./Waiver.module.css";

const stamp = (iso: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(iso));

/**
 * /admin/waiver/signed/[id]: a signed release, read-only — the words the parent read, ✓/✗ on every choice, the
 * name, relationship, signature, when, version and language. "Print or save as PDF" uses the browser's print.
 */
export default function SignedWaiverView({ id }: { id: string }) {
  const [waiver, setWaiver] = useState<SignedWaiver | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    waiverApi
      .signed(id)
      .then(setWaiver)
      .catch((e: WaiverApiError) => setProblem(e.status === 401 ? "Sign in to the owner area first." : e.message));
  }, [id]);

  const s = waiver?.snapshot;
  return (
    <div className={css.kiosk}>
      <div className={`${css.bar} ${css.noPrint}`}>
        <span className={css.brand}>
          <span className={css.sun} aria-hidden="true" />
          Signed waiver{waiver ? ` · ${waiver.familyName}` : ""}
        </span>
        <span className={css.ownerBox}>
          {waiver && (
            <button type="button" className={css.barButton} onClick={() => window.print()}>
              Print or save as PDF
            </button>
          )}
          <Link className={css.ownerLink} href="/admin/leads">
            ← Leads
          </Link>
        </span>
      </div>
      <div className={css.body}>
        {!waiver || !s ? (
          <p className={css.notice} role={problem ? "alert" : "status"}>{problem ?? "Opening the signed release…"}</p>
        ) : (
          <>
            {waiver.status !== "signed" && (
              <p className={`${css.notice} ${css.noPrint}`} role="note">
                {waiver.status === "revoked"
                  ? `Permission taken back ${waiver.revokedAt ? stamp(waiver.revokedAt) : ""}${waiver.revokeNote ? ` (${waiver.revokeNote})` : ""}. Don't use their photos in anything new.`
                  : "Replaced by a newer release for this booking."}
              </p>
            )}
            {!waiver.bookingExists && <p className={`${css.notice} ${css.noPrint}`} role="note">The lead was deleted. This release is kept as your record.</p>}
            <p className={`${css.summary} ${css.noPrint}`}>
              {waiver.reference} · {usesSummary(waiver.uses)}
            </p>
            <WaiverPaper
              snapshot={s}
              choices={
                <ul className={css.choices}>
                  {s.uses.map((u) => (
                    <Mark key={u.key} on={waiver.uses[u.key]}>{u.label}</Mark>
                  ))}
                </ul>
              }
              firstName={
                s.firstName && (
                  <ul className={css.choices}>
                    <Mark on={waiver.firstNameOk}>{s.firstName.label}</Mark>
                  </ul>
                )
              }
              you={
                <>
                  <p>
                    <b>{s.labels.fullName}:</b> {waiver.signerName}
                    <br />
                    <b>{s.labels.relationship}:</b> {waiver.relationship === "guardian" ? s.labels.guardian : s.labels.parent}
                  </p>
                  <ul className={css.choices}>
                    <Mark on>{s.labels.agree}</Mark>
                  </ul>
                  <div className={css.signedBox}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL from the database, not an optimizable file */}
                    <img src={waiver.signature} alt={`Signature of ${waiver.signerName}`} />
                  </div>
                  <p className={css.paperMeta}>
                    {s.labels.date}: {stamp(waiver.signedAt)} (Miami time) · {waiver.version} · {waiver.language === "es" ? "Signed in Spanish" : "Signed in English"}
                  </p>
                  <p className={css.paperMeta}>Record {waiver.id.slice(0, 8)} · text fingerprint {waiver.sha256.slice(0, 16)}</p>
                </>
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
