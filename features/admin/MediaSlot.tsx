"use client";

import Image from "next/image";
import { useState, type ChangeEvent, type ReactNode } from "react";
import type { PortfolioPhoto } from "@/config/portfolio";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

/** One picture in Photos / Media: thumbnail, Replace, its details (title, description, caption, Spanish) and reset. */
export default function MediaSlot({ name, groupLabel, custom, inherited, inheritedLabel, inheritedNote, note, round, builtIn, busy, onReplace, onReset, onDetails, resetLabel = "Use built-in picture", captions = true, spanishLive = false, children }: {
  name: string; groupLabel: string; custom: PortfolioPhoto | null; builtIn: PortfolioPhoto | null; busy: boolean;
  /** The Original theme's picture for this slot (shown when this theme has none). */
  inherited?: PortfolioPhoto | null; inheritedLabel?: string;
  /** Overrides "Same as the … theme" (e.g. the email photo borrowed from About Us). */
  inheritedNote?: string;
  /** Round preview (the email shows this photo as a circle). */
  round?: boolean;
  onReplace: (e: ChangeEvent<HTMLInputElement>) => void; onReset: () => void; onDetails: (p: PortfolioPhoto) => void; resetLabel?: string;
  /** Show the caption field (pictures in "Little moments" show a caption under the photo). */
  captions?: boolean;
  /** Replaces "Your picture" under the thumbnail. */
  note?: string;
  /** The Spanish site is switched on: say when this picture still needs its Spanish details. */
  spanishLive?: boolean;
  /** Extra controls under the picture (e.g. a section's move / box / landing page options). */
  children?: ReactNode;
}) {
  const shown = custom ?? inherited ?? builtIn;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(shown?.title ?? "");
  const [alt, setAlt] = useState(shown?.alt ?? "");
  const [caption, setCaption] = useState(shown?.caption ?? "");
  const [spanishTitle, setSpanishTitle] = useState(shown?.spanish?.title ?? "");
  const [spanishAlt, setSpanishAlt] = useState(shown?.spanish?.alt ?? "");
  const [spanishCaption, setSpanishCaption] = useState(shown?.spanish?.caption ?? "");
  const spanishStarted = Boolean(spanishTitle.trim() || spanishAlt.trim() || spanishCaption.trim());
  const spanishIncomplete = spanishStarted && (
    !spanishTitle.trim() ||
    !spanishAlt.trim() ||
    (captions && Boolean(caption.trim()) && !spanishCaption.trim())
  );
  return (
    <div className={styles.slot}>
      <p className={cn(styles.slotName, "chalk-soft")}>{name}</p>
      <div className={cn(styles.slotThumb, round && styles.slotThumbRound)}>
        {shown ? <Image src={shown.src} alt={shown.alt} fill sizes="220px" style={{ objectFit: "cover" }} unoptimized={shown.src.startsWith("data:")} /> : null}
        {busy && <span className={cn(styles.slotBusy, "chalk-soft")}>Saving…</span>}
      </div>
      <p className={cn(styles.slotSource, "chalk-soft")}>{custom ? (note ?? "Your picture") : inherited ? (inheritedNote ?? `Same as the ${inheritedLabel} theme`) : builtIn ? "Built-in picture" : round ? "No photo: the email skips it" : "Photo coming soon"}</p>
      <label className={cn(styles.smallButton, styles.replaceBtn)}>
        <input type="file" accept="image/*" className={styles.visuallyHidden} onChange={onReplace} aria-label={`Replace ${groupLabel} ${name}`} disabled={busy} />
        {shown ? "Replace" : "Add picture"}
      </label>
      {captions && shown && <p className={cn(styles.slotCaption, "chalk-soft")}>{shown.caption ? `Caption: “${shown.caption}”` : "No caption: the photo fills the frame"}</p>}
      {shown && (
        <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide details" : captions ? "Caption & details" : "Details"}</button>
      )}
      {spanishLive && custom && !custom.spanish && <p className={cn(styles.error, styles.slotWarning, "chalk-soft")}>Needs its Spanish details (open “{captions ? "Caption & details" : "Details"}”): until then the Spanish site stays hidden.</p>}
      {custom && <button type="button" className={cn(styles.linkButton, styles.dangerText, "chalk-soft")} onClick={onReset} disabled={busy}>{resetLabel}</button>}
      {children}
      {open && shown && (
        <div className={styles.slotDetails}>
          {captions && (
            <label className={cn(styles.label, "chalk-soft")}>
              Caption under the photo (optional)
              <input className={styles.input} value={caption} maxLength={40} placeholder="e.g. First week" onChange={(e) => setCaption(e.target.value)} aria-label={`${groupLabel} ${name} caption`} />
              <span className={cn(styles.hintSmall, "chalk-soft")}>Leave empty and the photo fills the whole frame.</span>
            </label>
          )}
          <label className={cn(styles.label, "chalk-soft")}>{captions ? "Title (shown when a parent books this photo)" : "Photo title"}<input className={styles.input} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className={cn(styles.label, "chalk-soft")}>Description for screen readers<input className={styles.input} value={alt} maxLength={160} onChange={(e) => setAlt(e.target.value)} /></label>
          <p className={cn(styles.label, "chalk-soft")}>Spanish photo details (optional until the Spanish site is published)</p>
          {captions && (
            <label className={cn(styles.label, "chalk-soft")}>
              Caption under the photo (Spanish{caption.trim() ? " · required when Spanish details are started" : " · optional"})
              <input className={styles.input} value={spanishCaption} maxLength={40} onChange={(e) => setSpanishCaption(e.target.value)} aria-label={`${groupLabel} ${name} caption (Spanish)`} />
            </label>
          )}
          <label className={cn(styles.label, "chalk-soft")}>{captions ? "Title (Spanish)" : "Photo title (Spanish)"}<input className={styles.input} value={spanishTitle} maxLength={60} onChange={(e) => setSpanishTitle(e.target.value)} /></label>
          <label className={cn(styles.label, "chalk-soft")}>Description for screen readers (Spanish)<input className={styles.input} value={spanishAlt} maxLength={160} onChange={(e) => setSpanishAlt(e.target.value)} /></label>
          {spanishIncomplete && <p className={cn(styles.error, "chalk-soft")}>Complete the Spanish title and description{captions && caption.trim() ? ", plus the matching caption," : ""} or leave all Spanish fields blank.</p>}
          <button
            type="button"
            className={styles.smallButton}
            disabled={busy || !title.trim() || spanishIncomplete}
            onClick={() => onDetails({
              ...shown,
              title: title.trim(),
              alt: alt.trim() || title.trim(),
              caption: captions ? caption.trim() : shown.caption,
              spanish: spanishStarted
                ? { title: spanishTitle.trim(), alt: spanishAlt.trim(), caption: captions ? spanishCaption.trim() || undefined : shown.spanish?.caption }
                : null,
            })}
          >
            Save details
          </button>
        </div>
      )}
    </div>
  );
}
