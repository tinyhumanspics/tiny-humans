"use client";

import Image from "next/image";
import { useState, type ChangeEvent } from "react";
import { MEDIA_GROUPS, sectionsFor, type MediaSection, type ThemeMedia } from "@/config/media";
import type { PortfolioPhoto } from "@/config/portfolio";
import en from "@/messages/en.json";
import AdminDialog from "./AdminDialog";
import MediaSlot from "./MediaSlot";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

type Draft = { sections: MediaSection[]; picks: string[] };
type Confirm = { kind: "delete"; index: number } | { kind: "restart" } | null;

const { maxSections, maxPhotos, landingPicks: maxPicks } = MEDIA_GROUPS.sections;
const BOX = `“${en.home.portfolio.ctaLabel}” box`;
const newSectionId = () => `section-${Math.random().toString(36).slice(2, 9)}`;
const boxPhotoId = (s: MediaSection) => (s.photos.some((p) => p.id === s.promptPhotoId) ? s.promptPhotoId : s.photos[Math.min(1, s.photos.length - 1)]?.id);
const sectionName = (s: MediaSection, i: number) => `Section ${i + 1}${s.title ? ` · “${s.title}”` : ""}`;
/** Titles made from camera / export file names ("IMG 7378", "TinyHumans DSC09689 Vertical"): parents see this title while booking. */
const looksLikeFileName = (title: string) => /^(img|dsc|dscf|pxl|mvimg|screenshot|new photo)\b|^photo \d+$|\d{4,}|tinyhumans|_/i.test(title.trim());

/** A picture's id changed (replaced) or it is gone (null): keep the box picture and the landing page picks pointing at it. */
function swapPhotoId(d: Draft, oldId: string, newId: string | null) {
  for (const s of d.sections) if (s.promptPhotoId === oldId) s.promptPhotoId = newId;
  d.picks = newId ? d.picks.map((id) => (id === oldId ? newId : id)) : d.picks.filter((id) => id !== oldId);
}

/**
 * Photos / Media → "Little moments" sections for one theme: add, order and delete sections; add, replace, order and
 * remove their pictures; switch each section's box on or off, with its wording and picture; pick the ad landing page's
 * pictures. A theme other than Original shows the Original theme's sections until something changes here, then it
 * gets its own copy. Every change saves at once, like the rest of this page.
 */
export default function MediaSections({ media, base, themeId, isOriginal, themeLabel, baseLabel, spanishLive, busy, setBusy, fail, saveMedia, toPhoto }: {
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
  toPhoto: (file: File, previous?: PortfolioPhoto | null) => Promise<PortfolioPhoto>;
}) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const { sections, landingPicks } = sectionsFor(media, base);
  const inheriting = !media.sections && !isOriginal;
  const builtIn = isOriginal && !media.sections;
  const picksFull = landingPicks.length >= maxPicks;

  const edit = (key: string, okText: string, change: (d: Draft) => void) => {
    const draft: Draft = { sections: JSON.parse(JSON.stringify(sections)), picks: [...landingPicks] };
    change(draft);
    const copied = inheriting ? ` The ${themeLabel} theme now has its own sections (the ${baseLabel} theme didn't change).` : "";
    return saveMedia({ ...media, sections: draft.sections, landingPicks: draft.picks }, key, `${okText}${copied}`);
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
    await saveMedia({ ...media, sections: null, landingPicks: [] }, "sections-restart", `The ${themeLabel} theme shows the ${baseLabel} theme's sections again.`);
    setConfirm(null);
  };

  const remove = async (index: number) => {
    const s = sections[index];
    await edit(`section-${s.id}`, `${sectionName(s, index)} deleted.`, (d) => {
      for (const p of d.sections[index].photos) swapPhotoId(d, p.id, null);
      d.sections.splice(index, 1);
    });
    setConfirm(null);
  };

  const deleting = confirm?.kind === "delete" ? sections[confirm.index] : null;

  return (
    <div className={styles.mediaGroup}>
      <h3 className={cn(styles.mediaGroupTitle, "chalk")}>{MEDIA_GROUPS.sections.label}</h3>
      <p className={cn(styles.hintSmall, "chalk-soft")}>{MEDIA_GROUPS.sections.where} Up to {maxSections} sections with {maxPhotos} pictures each.</p>
      {inheriting && (
        <p className={cn(styles.sectionNote, "chalk-soft")}>
          The {themeLabel} theme uses the {baseLabel} theme&apos;s sections. Change anything below and the {themeLabel} theme gets its own copy; the {baseLabel} theme stays as it is.
        </p>
      )}
      {!inheriting && !isOriginal && (
        <div className={styles.sectionRestart}>
          <p className={cn(styles.hintSmall, "chalk-soft")}>The {themeLabel} theme has its own sections.</p>
          <button type="button" className={styles.smallButton} onClick={() => setConfirm({ kind: "restart" })} disabled={busy !== null}>Start over from the {baseLabel} theme&apos;s sections</button>
        </div>
      )}
      <p className={cn(styles.sectionNote, "chalk-soft")}>
        <b>Ad landing page (/home-sweet-home):</b>{" "}
        {landingPicks.length
          ? `${landingPicks.length} of ${maxPicks} pictures picked (“On landing page” under a picture).`
          : `no pictures picked, so it shows the first ${maxPicks}. Tick “On landing page” under up to ${maxPicks} pictures to choose them yourself.`}
      </p>

      {sections.map((section, si) => {
        const key = `section-${section.id}`;
        const boxId = boxPhotoId(section);
        return (
          <section key={`${themeId}-${section.id}`} className={styles.sectionCard} aria-labelledby={`${key}-title`}>
            <div className={styles.sectionHead}>
              <h4 id={`${key}-title`} className={cn(styles.sectionTitle, "chalk")}>{sectionName(section, si)}</h4>
              <div className={styles.sectionActions}>
                <button type="button" className={styles.smallButton} disabled={si === 0 || busy !== null} aria-label={`Move section ${si + 1} up`}
                  onClick={() => edit(key, `Section ${si + 1} moved up.`, (d) => d.sections.splice(si - 1, 0, ...d.sections.splice(si, 1)))}>↑ Up</button>
                <button type="button" className={styles.smallButton} disabled={si === sections.length - 1 || busy !== null} aria-label={`Move section ${si + 1} down`}
                  onClick={() => edit(key, `Section ${si + 1} moved down.`, (d) => d.sections.splice(si + 1, 0, ...d.sections.splice(si, 1)))}>↓ Down</button>
                <button type="button" className={cn(styles.smallButton, styles.danger)} disabled={busy !== null} onClick={() => setConfirm({ kind: "delete", index: si })}>Delete section</button>
              </div>
            </div>
            <p className={cn(styles.hintSmall, "chalk-soft")}>
              {section.photos.length
                ? `${section.photos.length} picture${section.photos.length > 1 ? "s" : ""}${section.prompt ? `, then the ${BOX}.` : `. The box is switched off.`}`
                : "No pictures yet: this section is hidden on the website until you add one."}
            </p>
            <div className={styles.slotGrid}>
              {section.photos.map((photo, pi) => {
                const name = `Image ${pi + 1}`;
                const photoKey = `${key}-${photo.id}`;
                const picked = landingPicks.includes(photo.id);
                return (
                  <MediaSlot key={`${themeId}-${photo.id}`} name={name} groupLabel={`Section ${si + 1}`} custom={photo} builtIn={null} busy={busy === photoKey} spanishLive={spanishLive}
                    note={inheriting ? `Same as the ${baseLabel} theme` : photo.src.startsWith("/portfolio/") ? "Built-in picture" : undefined}
                    onReplace={(e) => withFiles(photoKey, e, 1, async ([file]) => {
                      const next = await toPhoto(file, photo);
                      await edit(photoKey, `Section ${si + 1} · ${name} replaced.`, (d) => {
                        d.sections[si].photos[pi] = next;
                        swapPhotoId(d, photo.id, next.id);
                      });
                    })}
                    onReset={() => edit(photoKey, `Section ${si + 1} · ${name} removed.`, (d) => {
                      d.sections[si].photos.splice(pi, 1);
                      swapPhotoId(d, photo.id, null);
                    })}
                    resetLabel="Remove"
                    onDetails={(p) => edit(photoKey, p.caption ? `Caption saved: “${p.caption}”.` : "Saved. No caption, so the photo fills the frame.", (d) => {
                      d.sections[si].photos[pi] = p;
                    })}>
                    <div className={styles.slotTools}>
                      <button type="button" className={styles.smallButton} disabled={pi === 0 || busy !== null} aria-label={`Move section ${si + 1} ${name} earlier`}
                        onClick={() => edit(photoKey, `Section ${si + 1} · ${name} moved.`, (d) => d.sections[si].photos.splice(pi - 1, 0, ...d.sections[si].photos.splice(pi, 1)))}>←</button>
                      <button type="button" className={styles.smallButton} disabled={pi === section.photos.length - 1 || busy !== null} aria-label={`Move section ${si + 1} ${name} later`}
                        onClick={() => edit(photoKey, `Section ${si + 1} · ${name} moved.`, (d) => d.sections[si].photos.splice(pi + 1, 0, ...d.sections[si].photos.splice(pi, 1)))}>→</button>
                    </div>
                    {section.prompt && (boxId === photo.id
                      ? <p className={cn(styles.boxPick, "chalk-soft")}>★ In the box</p>
                      : <button type="button" className={cn(styles.linkButton, "chalk-soft")} disabled={busy !== null}
                          onClick={() => edit(photoKey, `Section ${si + 1}: the box now shows ${name}.`, (d) => { d.sections[si].promptPhotoId = photo.id; })}>Use in the box</button>)}
                    <label className={styles.toggle}>
                      <input type="checkbox" checked={picked} disabled={busy !== null || (!picked && picksFull)} aria-label={`Section ${si + 1} ${name}: on landing page`}
                        onChange={(e) => edit(photoKey, e.target.checked ? `${name} added to the landing page.` : `${name} taken off the landing page.`, (d) => {
                          d.picks = e.target.checked ? [...d.picks, photo.id] : d.picks.filter((id) => id !== photo.id);
                        })} />
                      On landing page
                    </label>
                  </MediaSlot>
                );
              })}
              {section.photos.length < maxPhotos && (
                <label className={cn(styles.addTile, "chalk-soft")}>
                  <input type="file" accept="image/*" multiple className={styles.visuallyHidden} disabled={busy !== null} aria-label={`Add pictures to section ${si + 1}`}
                    onChange={(e) => withFiles(`${key}-add`, e, maxPhotos - section.photos.length, async (files) => {
                      const added: PortfolioPhoto[] = [];
                      for (const f of files) added.push(await toPhoto(f));
                      await edit(`${key}-add`, `${added.length} picture${added.length > 1 ? "s" : ""} added to section ${si + 1}.`, (d) => { d.sections[si].photos.push(...added); });
                    })} />
                  {busy === `${key}-add` ? "Adding…" : "+ Add pictures"}
                </label>
              )}
            </div>
            <SectionBox key={`${themeId}-${section.id}-box`} section={section} index={si} busy={busy === `${key}-box`}
              picture={section.photos.flatMap((photo, pi) => (photo.id === boxId ? [{ photo, name: `Image ${pi + 1}` }] : []))[0]}
              onSave={(box) => edit(`${key}-box`, box.prompt ? `Section ${si + 1}: box saved.` : `Section ${si + 1}: the box is switched off.`, (d) => { Object.assign(d.sections[si], box); })} />
          </section>
        );
      })}

      {sections.length < maxSections ? (
        <button type="button" className={cn(styles.addButton, styles.addSection)} disabled={busy !== null}
          onClick={() => edit("section-add", "New section added at the bottom. Add pictures to show it on the website.", (d) => {
            d.sections.push({ id: newSectionId(), photos: [], prompt: false, promptPhotoId: null, title: "", text: "", spanish: null });
          })}>
          {busy === "section-add" ? "Adding…" : "+ Add a section"}
        </button>
      ) : (
        <p className={cn(styles.hintSmall, "chalk-soft")}>That&apos;s the most sections ({maxSections}). Delete one to add another.</p>
      )}
      {builtIn && <p className={cn(styles.hintSmall, "chalk-soft")}>These are the built-in sections until you change something.</p>}

      {deleting && confirm?.kind === "delete" && (
        <AdminDialog labelledBy="section-del-t" describedBy="section-del-d" onClose={() => setConfirm(null)} busy={busy !== null}>
          <h3 id="section-del-t" className={cn(styles.h3, "chalk")}>Delete {sectionName(deleting, confirm.index)}?</h3>
          <p id="section-del-d" className={cn(styles.muted, "chalk-soft")}>
            {deleting.photos.length ? `Its ${deleting.photos.length} picture${deleting.photos.length > 1 ? "s" : ""}${deleting.prompt ? " and its box" : ""} disappear from the website. This can't be undone.` : "It has no pictures yet."}
          </p>
          <div className={styles.photoBar}>
            <button type="button" className={styles.smallButton} onClick={() => setConfirm(null)} disabled={busy !== null}>Cancel</button>
            <button type="button" className={cn(styles.smallButton, styles.deleteBtn)} onClick={() => remove(confirm.index)} disabled={busy !== null}>{busy ? "Deleting…" : "Delete section"}</button>
          </div>
        </AdminDialog>
      )}
      {confirm?.kind === "restart" && (
        <AdminDialog labelledBy="section-restart-t" describedBy="section-restart-d" onClose={() => setConfirm(null)} busy={busy !== null}>
          <h3 id="section-restart-t" className={cn(styles.h3, "chalk")}>Start over from the {baseLabel} theme&apos;s sections?</h3>
          <p id="section-restart-d" className={cn(styles.muted, "chalk-soft")}>
            The {themeLabel} theme&apos;s own sections, pictures and box wording are deleted, and it shows the {baseLabel} theme&apos;s sections again. This can&apos;t be undone.
          </p>
          <div className={styles.photoBar}>
            <button type="button" className={styles.smallButton} onClick={() => setConfirm(null)} disabled={busy !== null}>Cancel</button>
            <button type="button" className={cn(styles.smallButton, styles.deleteBtn)} onClick={restart} disabled={busy !== null}>{busy ? "Saving…" : "Start over"}</button>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}

/** A section's box: on/off, its English + Spanish wording (all four needed to show it). */
function SectionBox({ section, index, busy, picture, onSave }: {
  section: MediaSection;
  index: number;
  busy: boolean;
  /** The picture in the box: the "role model" a parent books with after tapping it. */
  picture?: { photo: PortfolioPhoto; name: string };
  onSave: (box: Pick<MediaSection, "prompt" | "title" | "text" | "spanish">) => Promise<void>;
}) {
  const [on, setOn] = useState(section.prompt);
  const [title, setTitle] = useState(section.title);
  const [text, setText] = useState(section.text);
  const [spanishTitle, setSpanishTitle] = useState(section.spanish?.title ?? "");
  const [spanishText, setSpanishText] = useState(section.spanish?.text ?? "");
  const fields = [title, text, spanishTitle, spanishText].map((v) => v.trim());
  const incomplete = on && fields.some((v) => !v);
  const dirty = on !== section.prompt || title !== section.title || text !== section.text || spanishTitle !== (section.spanish?.title ?? "") || spanishText !== (section.spanish?.text ?? "");
  const label = `Section ${index + 1}`;
  return (
    <div className={styles.promptEdit}>
      <label className={styles.toggle}>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        Show the {BOX} after these pictures
      </label>
      {on && (
        <>
          {picture ? (
            <div className={styles.rolePick}>
              <Image src={picture.photo.src} alt="" width={picture.photo.width} height={picture.photo.height} sizes="112px" className={styles.rolePickThumb} unoptimized={picture.photo.src.startsWith("data:")} />
              <div className={styles.rolePickText}>
                <p className={cn(styles.hintSmall, "chalk-soft")}>
                  A parent who taps the box books with {picture.name} (★ In the box). The booking steps show it as <b>“{picture.photo.title}”</b>
                  {picture.photo.spanish ? <> (Spanish site: <b>“{picture.photo.spanish.title}”</b>)</> : " (no Spanish title yet)"}.
                  Change that name in the picture&apos;s “Caption &amp; details”, or pick another picture with “Use in the box”.
                </p>
                {looksLikeFileName(picture.photo.title) && (
                  <p className={cn(styles.error, styles.slotWarning, "chalk-soft")}>“{picture.photo.title}” looks like a file name. Give this picture a nicer title in its “Caption &amp; details”: parents see it while they book.</p>
                )}
              </div>
            </div>
          ) : (
            <p className={cn(styles.hintSmall, "chalk-soft")}>Add a picture first: the box shows one of this section&apos;s pictures, and a parent who taps it books with that picture.</p>
          )}
          <p className={cn(styles.label, "chalk-soft")}>Box wording (English)</p>
          <input className={styles.input} value={title} maxLength={60} placeholder="Title, e.g. Love this one?" onChange={(e) => setTitle(e.target.value)} aria-label={`${label}: box title`} />
          <input className={styles.input} value={text} maxLength={120} placeholder="Text, e.g. We'll plan your session around it." onChange={(e) => setText(e.target.value)} aria-label={`${label}: box text`} />
          <p className={cn(styles.label, "chalk-soft")}>Box wording (Spanish)</p>
          <input className={styles.input} value={spanishTitle} maxLength={60} placeholder="Título, p. ej. ¿Te encanta esta?" onChange={(e) => setSpanishTitle(e.target.value)} aria-label={`${label}: Spanish box title`} />
          <input className={styles.input} value={spanishText} maxLength={120} placeholder="Texto, p. ej. Planificaremos tu sesión inspirándonos en ella." onChange={(e) => setSpanishText(e.target.value)} aria-label={`${label}: Spanish box text`} />
        </>
      )}
      <div className={styles.photoBar}>
        <span className={cn(incomplete ? styles.error : styles.hintSmall, "chalk-soft")}>
          {incomplete ? "Fill in the English and Spanish title and text to show the box." : dirty ? "Not saved yet." : on ? "Saved." : "The box is hidden for this section."}
        </span>
        <button type="button" className={styles.smallButton} disabled={!dirty || busy || incomplete}
          onClick={() => onSave({
            prompt: on,
            title: title.trim(),
            text: text.trim(),
            spanish: fields[2] && fields[3] ? { title: fields[2], text: fields[3] } : null,
          })}>
          {busy ? "Saving…" : "Save box"}
        </button>
      </div>
    </div>
  );
}
