"use client";

import { useState, type ChangeEvent } from "react";
import { chunkSections, MEDIA_GROUPS, resolveMedia, sectionsFor, type ThemeMedia } from "@/config/media";
import type { PortfolioPhoto } from "@/config/portfolio";
import AdminDialog from "./AdminDialog";
import MediaSlot from "./MediaSlot";
import MediaFold from "./MediaFold";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

type Draft = { photos: PortfolioPhoto[]; picks: string[] };

const { maxSections, maxPhotos, landingPicks: maxPicks } = MEDIA_GROUPS.sections;
/** Pictures in "Little moments" (saved as sections of `maxPhotos` behind the scenes; see `chunkSections`). */
const MAX = maxSections * maxPhotos;
/** Titles made from camera / export file names ("IMG 7378", "TinyHumans DSC09689 Vertical"): parents see the title as their inspo. */
const looksLikeFileName = (title: string) => /^(img|dsc|dscf|pxl|mvimg|screenshot|new photo)\b|^photo \d+$|\d{4,}|tinyhumans|_/i.test(title.trim());

/**
 * Photos / Media → "Little moments" for one theme (owner, Nov 11: one list, no sections or boxes): add, replace, order
 * and remove pictures, their words (English + Spanish; the title is what parents see when they use one as their
 * inspiration) and which ones show on the ad page. A theme other than Original shows the Original theme's pictures
 * until something changes here, then it gets its own copy. Every change saves at once, like the rest of this page.
 */
export default function MediaSections({ media, base, themeId, isOriginal, themeLabel, baseLabel, spanishLive, busy, setBusy, fail, saveMedia, toPhoto, openByDefault = false }: {
  media: ThemeMedia;
  /** The Original theme's pictures (undefined while editing the Original theme, or before it has any). */
  base?: ThemeMedia;
  themeId: string;
  isOriginal: boolean;
  themeLabel: string;
  baseLabel: string;
  spanishLive: boolean;
  busy: string | null;
  setBusy: (key: string | null) => void;
  fail: (err: unknown, fallback: string) => void;
  saveMedia: (next: ThemeMedia, key: string, okText: string) => Promise<void>;
  /** Open this part when the page loads. */
  openByDefault?: boolean;
  toPhoto: (file: File, previous?: PortfolioPhoto | null) => Promise<PortfolioPhoto>;
}) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const { sections, landingPicks } = sectionsFor(media, base);
  const photos = sections.flatMap((s) => s.photos);
  const inheriting = !media.sections && !isOriginal;
  const builtIn = isOriginal && !media.sections;
  // what the ad landing page shows right now (the ticked pictures, else the first 6 that aren't title photos): the ticks match it
  const onLanding = new Set(resolveMedia(media, base).gallery.map((p) => p.id));
  const automatic = landingPicks.length === 0;
  const landingFull = onLanding.size >= maxPicks;

  const edit = (key: string, okText: string, change: (d: Draft) => void) => {
    const draft: Draft = { photos: [...photos], picks: [...landingPicks] };
    change(draft);
    const copied = inheriting ? ` The ${themeLabel} theme now has its own pictures (the ${baseLabel} theme didn't change).` : "";
    return saveMedia({ ...media, sections: chunkSections(draft.photos, sections), landingPicks: draft.picks }, key, `${okText}${copied}`);
  };

  const withFiles = async (key: string, e: ChangeEvent<HTMLInputElement>, limit: number, handle: (files: File[]) => Promise<void>) => {
    const files = Array.from(e.target.files ?? []).slice(0, limit);
    e.target.value = "";
    if (!files.length) return;
    setBusy(key);
    try {
      await handle(files);
    } catch (err) {
      setBusy(null);
      fail(err, "Couldn't use that picture.");
    }
  };

  const restart = async () => {
    await saveMedia({ ...media, sections: null, landingPicks: [] }, "sections-restart", `The ${themeLabel} theme shows the ${baseLabel} theme's pictures again.`);
    setConfirmRestart(false);
  };

  const summary = `${photos.length} picture${photos.length === 1 ? "" : "s"} · ${onLanding.size} on the ad page`;

  return (
    <MediaFold title={MEDIA_GROUPS.sections.label} summary={summary} open={openByDefault}
      where={<>{MEDIA_GROUPS.sections.where} Press <b>Edit</b> on a picture to replace it, move it, change its words (parents see its title as their inspiration) or put it on the ad page.</>}>
      {inheriting && (
        <p className={cn(styles.sectionNote, "chalk-soft")}>
          The {themeLabel} theme uses the {baseLabel} theme&apos;s pictures. Change anything below and the {themeLabel} theme gets its own copy; the {baseLabel} theme stays as it is.
        </p>
      )}
      {!inheriting && !isOriginal && (
        <div className={styles.sectionRestart}>
          <p className={cn(styles.hintSmall, "chalk-soft")}>The {themeLabel} theme has its own pictures.</p>
          <button type="button" className={styles.smallButton} onClick={() => setConfirmRestart(true)} disabled={busy !== null}>Start over from the {baseLabel} theme&apos;s pictures</button>
        </div>
      )}
      <p className={cn(styles.sectionNote, "chalk-soft")}>
        <b>Ad page (/home-sweet-home):</b>{" "}
        {automatic
          ? `shows the first ${onLanding.size} pictures (tagged “On the ad page”). To choose them yourself, open Edit on a picture.`
          : `shows the ${onLanding.size} picture${onLanding.size === 1 ? "" : "s"} you chose (tagged “On the ad page”, up to ${maxPicks}).`}
        {!automatic && (
          <>
            {" "}
            <button type="button" className={cn(styles.linkButton, "chalk-soft")} disabled={busy !== null}
              onClick={() => edit("landing-auto", `The ad page shows the first ${maxPicks} pictures automatically again.`, (d) => { d.picks = []; })}>
              Go back to the first {maxPicks} automatically
            </button>
          </>
        )}
      </p>

      {!photos.length && <p className={cn(styles.hintSmall, "chalk-soft")}>No pictures yet: the gallery is hidden on the website until you add one.</p>}
      <div className={styles.slotGrid}>
        {photos.map((photo, pi) => {
          const name = `Image ${pi + 1}`;
          const photoKey = `moments-${photo.id}`;
          const shown = onLanding.has(photo.id);
          return (
            <MediaSlot key={`${themeId}-${photo.id}`} name={name} groupLabel={MEDIA_GROUPS.sections.label} custom={photo} builtIn={null} busy={busy === photoKey} spanishLive={spanishLive}
              note={inheriting ? `Same as the ${baseLabel} theme` : photo.src.startsWith("/portfolio/") ? "Built-in picture" : undefined}
              tags={shown && <span className={styles.tag}>On the ad page</span>}
              onReplace={(e) => withFiles(photoKey, e, 1, async ([file]) => {
                const next = await toPhoto(file, photo);
                await edit(photoKey, `${name} replaced.`, (d) => {
                  d.photos[pi] = next;
                  d.picks = d.picks.map((id) => (id === photo.id ? next.id : id));
                });
              })}
              onReset={() => edit(photoKey, `${name} removed.`, (d) => {
                d.photos.splice(pi, 1);
                d.picks = d.picks.filter((id) => id !== photo.id);
              })}
              resetLabel="Remove from the gallery"
              onDetails={(p) => edit(photoKey, p.caption ? `Caption saved: “${p.caption}”.` : "Saved. No caption, so the photo fills the frame.", (d) => {
                d.photos[pi] = p;
              })}>
              {looksLikeFileName(photo.title) && (
                <p className={cn(styles.error, styles.slotWarning, "chalk-soft")}>“{photo.title}” looks like a file name. Give it a nicer title below: parents see it when they use this picture as their inspiration.</p>
              )}
              <p className={cn(styles.label, "chalk-soft")}>Place in the gallery</p>
              <div className={styles.slotTools}>
                <button type="button" className={styles.smallButton} disabled={pi === 0 || busy !== null} aria-label={`Move ${name} earlier`}
                  onClick={() => edit(photoKey, `${name} moved.`, (d) => d.photos.splice(pi - 1, 0, ...d.photos.splice(pi, 1)))}>← Earlier</button>
                <button type="button" className={styles.smallButton} disabled={pi === photos.length - 1 || busy !== null} aria-label={`Move ${name} later`}
                  onClick={() => edit(photoKey, `${name} moved.`, (d) => d.photos.splice(pi + 1, 0, ...d.photos.splice(pi, 1)))}>Later →</button>
              </div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={shown} disabled={busy !== null || (!shown && landingFull)} aria-label={`${name}: on the ad page`}
                  onChange={(e) => {
                    // the first change while it's automatic starts from the pictures showing now
                    const showing = automatic ? [...onLanding] : landingPicks;
                    const next = e.target.checked ? [...showing, photo.id] : showing.filter((id) => id !== photo.id);
                    const ok = e.target.checked ? `${name} added to the ad page.`
                      : next.length ? `${name} taken off the ad page.`
                      : `${name} taken off the ad page. Nothing is chosen now, so it shows the first ${maxPicks} pictures automatically again.`;
                    return edit(photoKey, ok, (d) => { d.picks = next; });
                  }} />
                <span className="chalk-soft">Show on the ad page{automatic && shown ? " (picked automatically)" : ""}</span>
              </label>
            </MediaSlot>
          );
        })}
        {photos.length < MAX && (
          <label className={cn(styles.addTile, "chalk-soft")}>
            <input type="file" accept="image/*" multiple className={styles.visuallyHidden} disabled={busy !== null} aria-label="Add pictures to Little Moments"
              onChange={(e) => withFiles("moments-add", e, MAX - photos.length, async (files) => {
                const added: PortfolioPhoto[] = [];
                for (const f of files) added.push(await toPhoto(f));
                await edit("moments-add", `${added.length} picture${added.length > 1 ? "s" : ""} added at the end of the gallery.`, (d) => { d.photos.push(...added); });
              })} />
            {busy === "moments-add" ? "Adding…" : "+ Add pictures"}
          </label>
        )}
      </div>
      {photos.length >= MAX && <p className={cn(styles.hintSmall, "chalk-soft")}>That&apos;s the most pictures ({MAX}). Remove one to add another.</p>}
      {builtIn && <p className={cn(styles.hintSmall, "chalk-soft")}>These are the built-in pictures until you change something.</p>}

      {confirmRestart && (
        <AdminDialog labelledBy="moments-restart-t" describedBy="moments-restart-d" onClose={() => setConfirmRestart(false)} busy={busy !== null}>
          <h3 id="moments-restart-t" className={cn(styles.h3, "chalk")}>Start over from the {baseLabel} theme&apos;s pictures?</h3>
          <p id="moments-restart-d" className={cn(styles.muted, "chalk-soft")}>
            The {themeLabel} theme&apos;s own Little Moments pictures are deleted, and it shows the {baseLabel} theme&apos;s pictures again. This can&apos;t be undone.
          </p>
          <div className={styles.photoBar}>
            <button type="button" className={styles.smallButton} onClick={() => setConfirmRestart(false)} disabled={busy !== null}>Cancel</button>
            <button type="button" className={cn(styles.smallButton, styles.deleteBtn)} onClick={restart} disabled={busy !== null}>{busy ? "Saving…" : "Start over"}</button>
          </div>
        </AdminDialog>
      )}
    </MediaFold>
  );
}
