"use client";

import Image from "next/image";
import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import type { PortfolioPhoto } from "@/config/portfolio";
import AdminDialog from "./AdminDialog";
import { FillSpanishButton } from "./FillSpanish";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

/**
 * One picture in Photos / Media (simpler layout, owner Nov 11: "a bit complicated to understand"): the card shows the
 * picture, where it comes from, a few tags and one button. "Edit" opens everything else in a dialog: replace, remove,
 * the section tools (`children`), the words under/for the photo and their Spanish (filled in for the owner).
 */
export default function MediaSlot({ name, groupLabel, custom, inherited, inheritedLabel, inheritedNote, note, round, builtIn, busy, onReplace, onReset, onDetails, resetLabel = "Use built-in picture", captions = true, spanishLive = false, tags, children }: {
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
  /** Small tags on the card ("★ In the box", "On the ad page"). */
  tags?: ReactNode;
  /** Extra tools in the Edit dialog (a section's move / box / ad page options). */
  children?: ReactNode;
}) {
  const shown = custom ?? inherited ?? builtIn;
  const [open, setOpen] = useState(false);
  const id = useId();
  const source = custom ? (note ?? "Your picture") : inherited ? (inheritedNote ?? `Same as the ${inheritedLabel} theme`) : builtIn ? "Built-in picture" : round ? "No photo: the email skips it" : "Photo coming soon";
  return (
    <div className={styles.slot}>
      <p className={cn(styles.slotName, "chalk-soft")}>{name}</p>
      <div className={cn(styles.slotThumb, round && styles.slotThumbRound)}>
        {shown ? <Image src={shown.src} alt={shown.alt} fill sizes="220px" style={{ objectFit: "cover" }} unoptimized={shown.src.startsWith("data:")} /> : null}
        {busy && <span className={cn(styles.slotBusy, "chalk-soft")}>Saving…</span>}
      </div>
      <p className={cn(styles.slotSource, "chalk-soft")}>{source}</p>
      {captions && shown?.caption && <p className={cn(styles.slotCaption, "chalk-soft")}>“{shown.caption}”</p>}
      {tags && <div className={styles.slotTags}>{tags}</div>}
      {spanishLive && custom && !custom.spanish && <p className={cn(styles.error, styles.slotWarning, "chalk-soft")}>Needs its Spanish: open Edit and save once.</p>}
      {shown ? (
        <button type="button" className={styles.smallButton} onClick={() => setOpen(true)} disabled={busy} aria-label={`Edit ${groupLabel} ${name}`}>Edit</button>
      ) : (
        <label className={cn(styles.smallButton, styles.replaceBtn)}>
          <input type="file" accept="image/*" className={styles.visuallyHidden} onChange={onReplace} aria-label={`Add ${groupLabel} ${name}`} disabled={busy} />
          Add picture
        </label>
      )}
      {open && shown && (
        <AdminDialog labelledBy={`${id}-t`} onClose={() => setOpen(false)} busy={busy}>
          <PhotoEditor
            titleId={`${id}-t`} heading={`${groupLabel} · ${name}`} photo={shown} source={source} round={round} busy={busy} captions={captions}
            canRemove={Boolean(custom)} resetLabel={resetLabel} groupLabel={groupLabel} name={name}
            onReplace={onReplace} onReset={() => { onReset(); setOpen(false); }}
            onSave={(p) => { onDetails(p); setOpen(false); }} onClose={() => setOpen(false)}>
            {children}
          </PhotoEditor>
        </AdminDialog>
      )}
    </div>
  );
}

/** The Edit dialog's content: the picture and its buttons, the section tools, then the words (English + Spanish). */
function PhotoEditor({ titleId, heading, photo, source, round, busy, captions, canRemove, resetLabel, groupLabel, name, onReplace, onReset, onSave, onClose, children }: {
  titleId: string; heading: string; photo: PortfolioPhoto; source: string; round?: boolean; busy: boolean; captions: boolean;
  canRemove: boolean; resetLabel: string; groupLabel: string; name: string;
  onReplace: (e: ChangeEvent<HTMLInputElement>) => void; onReset: () => void; onSave: (p: PortfolioPhoto) => void; onClose: () => void; children?: ReactNode;
}) {
  const [title, setTitle] = useState(photo.title ?? "");
  const [alt, setAlt] = useState(photo.alt ?? "");
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [spanishTitle, setSpanishTitle] = useState(photo.spanish?.title ?? "");
  const [spanishAlt, setSpanishAlt] = useState(photo.spanish?.alt ?? "");
  const [spanishCaption, setSpanishCaption] = useState(photo.spanish?.caption ?? "");
  const spanishStarted = Boolean(spanishTitle.trim() || spanishAlt.trim() || spanishCaption.trim());
  const spanishIncomplete = spanishStarted && (!spanishTitle.trim() || !spanishAlt.trim() || (captions && Boolean(caption.trim()) && !spanishCaption.trim()));
  return (
    <div className={styles.photoEditor}>
      <h3 id={titleId} className={cn(styles.h3, "chalk")}>{heading}</h3>
      <div className={styles.photoEditorTop}>
        <div className={cn(styles.photoEditorThumb, round && styles.slotThumbRound)}>
          <Image src={photo.src} alt={photo.alt} fill sizes="240px" style={{ objectFit: "cover" }} unoptimized={photo.src.startsWith("data:")} />
        </div>
        <div className={styles.photoEditorButtons}>
          <p className={cn(styles.hintSmall, "chalk-soft")}>{source}</p>
          <label className={cn(styles.smallButton, styles.replaceBtn)}>
            <input type="file" accept="image/*" className={styles.visuallyHidden} onChange={onReplace} aria-label={`Replace ${groupLabel} ${name}`} disabled={busy} />
            {busy ? "Saving…" : "Replace picture"}
          </label>
          {canRemove && <button type="button" className={cn(styles.smallButton, styles.danger)} onClick={onReset} disabled={busy}>{resetLabel}</button>}
        </div>
      </div>
      {children && <div className={styles.photoEditorTools}>{children}</div>}

      <h4 className={cn(styles.photoEditorHead, "chalk")}>Words</h4>
      {captions && (
        <label className={cn(styles.label, "chalk-soft")}>
          Caption under the photo (optional)
          <input className={styles.input} value={caption} maxLength={40} placeholder="e.g. First week" onChange={(e) => setCaption(e.target.value)} aria-label={`${groupLabel} ${name} caption`} />
          <span className={cn(styles.hintSmall, "chalk-soft")}>Leave empty and the photo fills the whole frame.</span>
        </label>
      )}
      <label className={cn(styles.label, "chalk-soft")}>{captions ? "Title (parents see it when they book from this photo)" : "Photo title"}<input className={styles.input} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className={cn(styles.label, "chalk-soft")}>Description for screen readers<input className={styles.input} value={alt} maxLength={160} onChange={(e) => setAlt(e.target.value)} /></label>

      <h4 className={cn(styles.photoEditorHead, "chalk")}>Spanish</h4>
      <p className={cn(styles.hintSmall, "chalk-soft")}>Leave these empty and they&apos;re filled in for you when you save. Change anything you like.</p>
      <FillSpanishButton english={[title || alt, alt || title, captions ? caption : ""]} disabled={busy}
        onFill={([t, a, c]) => { setSpanishTitle(t); setSpanishAlt(a); if (captions) setSpanishCaption(c); }} />
      {captions && (
        <label className={cn(styles.label, "chalk-soft")}>
          Caption (Spanish)
          <input className={styles.input} value={spanishCaption} maxLength={40} onChange={(e) => setSpanishCaption(e.target.value)} aria-label={`${groupLabel} ${name} caption (Spanish)`} />
        </label>
      )}
      <label className={cn(styles.label, "chalk-soft")}>Title (Spanish)<input className={styles.input} value={spanishTitle} maxLength={60} onChange={(e) => setSpanishTitle(e.target.value)} /></label>
      <label className={cn(styles.label, "chalk-soft")}>Description for screen readers (Spanish)<input className={styles.input} value={spanishAlt} maxLength={160} onChange={(e) => setSpanishAlt(e.target.value)} /></label>
      {spanishIncomplete && <p className={cn(styles.error, "chalk-soft")}>Fill in the Spanish title and description{captions && caption.trim() ? " and caption" : ""}, or empty all Spanish boxes and they&apos;re filled in for you.</p>}

      <div className={styles.photoBar}>
        <button type="button" className={styles.smallButton} onClick={onClose} disabled={busy}>Close</button>
        <button
          type="button"
          className={cn(styles.smallButton, styles.primarySmall)}
          disabled={busy || !title.trim() || spanishIncomplete}
          onClick={() => onSave({
            ...photo,
            title: title.trim(),
            alt: alt.trim() || title.trim(),
            caption: captions ? caption.trim() : photo.caption,
            spanish: spanishStarted
              ? { title: spanishTitle.trim(), alt: spanishAlt.trim(), caption: captions ? spanishCaption.trim() || undefined : photo.spanish?.caption }
              : null,
          })}
        >
          Save words
        </button>
      </div>
    </div>
  );
}
