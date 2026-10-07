"use client";

import Image from "next/image";
import { useState, type ChangeEvent } from "react";
import { themes, THEME_IDS, type TinyHumansTheme } from "@/config/themes";
import { BUILT_IN, emptyThemeMedia, MEDIA_GROUPS, type ThemeMedia } from "@/config/media";
import type { PortfolioPhoto } from "@/config/portfolio";
import type { SiteSettings } from "@/lib/settings/types";
import { preparePhoto } from "@/lib/admin/client";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

type Upload = (b: Blob) => Promise<{ src: string }>;
type Note = { kind: "ok" | "error"; text: string } | null;

const newId = () => `photo-${Math.random().toString(36).slice(2, 9)}`;
const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "New photo";
const clone = (m: ThemeMedia): ThemeMedia => JSON.parse(JSON.stringify(m));

/**
 * Photos / Media: every editable picture, grouped by WHERE it appears on the
 * website, for one theme at a time. Each theme is stored independently.
 */
export default function MediaPanel({ settings, onSave, upload }: { settings: SiteSettings; onSave: (s: SiteSettings) => Promise<SiteSettings>; upload: Upload }) {
  const [themeId, setThemeId] = useState<TinyHumansTheme>(settings.themeId);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const media = settings.media[themeId] ?? emptyThemeMedia();
  const live = themeId === settings.themeId;
  const label = themes[themeId].label;

  const saveMedia = async (next: ThemeMedia, key: string, okText: string) => {
    setBusy(key);
    setNote(null);
    try {
      await onSave({ ...settings, media: { ...settings.media, [themeId]: next } });
      setNote({ kind: "ok", text: `${okText} ${live ? "It's live on the website now." : `Visitors will see it when the ${label} theme is active.`}` });
    } catch (e) {
      setNote({ kind: "error", text: e instanceof Error ? e.message : "Couldn't save. Please try again." });
    } finally {
      setBusy(null);
    }
  };

  const toPhoto = async (file: File, previous?: PortfolioPhoto | null): Promise<PortfolioPhoto> => {
    const { blob, width, height } = await preparePhoto(file);
    const { src } = await upload(blob);
    const title = previous?.title && previous.src !== src ? previous.title : titleFromFile(file.name);
    return { id: newId(), src, width, height, title, alt: previous?.alt || title, caption: previous?.caption ?? "" };
  };

  /** slot: ["title", i] | ["group", g, i] */
  const setSlot = async (path: [string, number, number?], photo: PortfolioPhoto | null, okText: string) => {
    const next = clone(media);
    if (path[0] === "title") next.title[path[1]] = photo;
    else next.groups[path[1]].photos[path[2]!] = photo;
    await saveMedia(next, path.join("-"), okText);
  };

  const replace = async (path: [string, number, number?], current: PortfolioPhoto | null, slotName: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(path.join("-"));
    try {
      await setSlot(path, await toPhoto(file, current), `${slotName} replaced.`);
    } catch (err) {
      setBusy(null);
      setNote({ kind: "error", text: err instanceof Error ? err.message : "Couldn't use that picture." });
    }
  };

  return (
    <section className={styles.section} aria-labelledby="media-title">
      <h2 id="media-title" className={cn(styles.h2, "chalk")}>Pictures by website section</h2>
      <p className={cn(styles.muted, "chalk-soft")}>Each theme has its own pictures. Changing one theme never changes another. Which theme visitors see is set in <b>Theme</b>.</p>
      <div className={styles.editTabs} role="group" aria-label="Theme to edit">
        {THEME_IDS.map((id) => (
          <button key={id} type="button" className={cn(styles.tab, themeId === id ? styles.tabActive : "")} aria-pressed={themeId === id} onClick={() => { setThemeId(id); setNote(null); }}>
            {themes[id].label}{id === settings.themeId ? " · live" : ""}
          </button>
        ))}
      </div>
      <p className={cn(styles.editingFor, "chalk-soft")} aria-live="polite">
        Editing media for: <b>{label}</b> {live ? <span className={styles.liveTag}>live on the site now</span> : <span className={styles.offTag}>not the active theme</span>}
      </p>
      {note && <p className={cn(note.kind === "ok" ? styles.ok : styles.error, "chalk-soft")} role={note.kind === "error" ? "alert" : "status"}>{note.text}</p>}

      <MediaGroupBlock label={MEDIA_GROUPS.title.label} where={`${MEDIA_GROUPS.title.where} These two are shown without captions.`}>
        {[0, 1].map((i) => (
          <Slot key={`t${i}-${themeId}`} name={`Image ${i + 1}`} groupLabel={MEDIA_GROUPS.title.label} custom={media.title[i]} builtIn={BUILT_IN.title[i]} busy={busy === `title-${i}`}
            onReplace={(e) => replace(["title", i], media.title[i], `${MEDIA_GROUPS.title.label} · Image ${i + 1}`, e)}
            onReset={() => setSlot(["title", i], null, `${MEDIA_GROUPS.title.label} · Image ${i + 1} is back to the built-in picture.`)}
            onDetails={(p) => setSlot(["title", i], p, "Details saved.")} captions={false} />
        ))}
      </MediaGroupBlock>

      {MEDIA_GROUPS.feed.map((g, gi) => (
        <MediaGroupBlock key={g.label} label={g.label} where={g.where}
          prompt={{ title: media.groups[gi]?.title ?? "", text: media.groups[gi]?.text ?? "", defaultTitle: g.defaultTitle, defaultText: g.defaultText, busy: busy === `prompt-${gi}`,
            onSave: (title, text) => { const next = clone(media); next.groups[gi].title = title.trim() || null; next.groups[gi].text = text.trim() || null; return saveMedia(next, `prompt-${gi}`, "Prompt text saved."); } }}>
          {[0, 1, 2].map((i) => (
            <Slot key={`g${gi}-${i}-${themeId}`} name={`Image ${i + 1}`} groupLabel={g.label} custom={media.groups[gi]?.photos[i] ?? null} builtIn={BUILT_IN.groups[gi][i]} busy={busy === `group-${gi}-${i}`}
              onReplace={(e) => replace(["group", gi, i], media.groups[gi]?.photos[i] ?? null, `${g.label} · Image ${i + 1}`, e)}
              onReset={() => setSlot(["group", gi, i], null, `${g.label} · Image ${i + 1} is back to the built-in picture.`)}
              onDetails={(p) => setSlot(["group", gi, i], p, p.caption ? `Caption saved: “${p.caption}”.` : "Saved. No caption, so the photo fills the frame.")} />
          ))}
        </MediaGroupBlock>
      ))}

      <MediaGroupBlock label={MEDIA_GROUPS.extra.label} where={MEDIA_GROUPS.extra.where}>
        {media.extra.map((p, i) => (
          <Slot key={p.id} name={`Extra image ${i + 1}`} groupLabel={MEDIA_GROUPS.extra.label} custom={p} builtIn={null} busy={busy === `extra-${i}`}
            onReplace={async (e) => {
              const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
              setBusy(`extra-${i}`);
              try { const next = clone(media); next.extra[i] = await toPhoto(file, p); await saveMedia(next, `extra-${i}`, `Extra image ${i + 1} replaced.`); } catch (err) { setBusy(null); setNote({ kind: "error", text: err instanceof Error ? err.message : "Couldn't use that picture." }); }
            }}
            onReset={() => { const next = clone(media); next.extra.splice(i, 1); return saveMedia(next, `extra-${i}`, `Extra image ${i + 1} removed.`); }}
            resetLabel="Remove"
            onDetails={(ph) => { const next = clone(media); next.extra[i] = ph; return saveMedia(next, `extra-${i}`, "Details saved."); }} />
        ))}
        {media.extra.length < MEDIA_GROUPS.extra.max && (
          <label className={cn(styles.addTile, "chalk-soft")}>
            <input type="file" accept="image/*" multiple className={styles.visuallyHidden}
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []).slice(0, MEDIA_GROUPS.extra.max - media.extra.length); e.target.value = ""; if (!files.length) return;
                setBusy("extra-add");
                try { const next = clone(media); for (const f of files) next.extra.push(await toPhoto(f)); await saveMedia(next, "extra-add", `${files.length} picture${files.length > 1 ? "s" : ""} added.`); } catch (err) { setBusy(null); setNote({ kind: "error", text: err instanceof Error ? err.message : "Couldn't add those pictures." }); }
              }} />
            {busy === "extra-add" ? "Adding…" : "+ Add pictures"}
          </label>
        )}
      </MediaGroupBlock>
    </section>
  );
}

function MediaGroupBlock({ label, where, prompt, children }: { label: string; where: string; prompt?: { title: string; text: string; defaultTitle: string; defaultText: string; busy: boolean; onSave: (t: string, x: string) => Promise<void> }; children: React.ReactNode }) {
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [text, setText] = useState(prompt?.text ?? "");
  const dirty = prompt ? title !== prompt.title || text !== prompt.text : false;
  return (
    <div className={styles.mediaGroup}>
      <h3 className={cn(styles.mediaGroupTitle, "chalk")}>{label}</h3>
      <p className={cn(styles.hintSmall, "chalk-soft")}>{where}</p>
      <div className={styles.slotGrid}>{children}</div>
      {prompt && (
        <div className={styles.promptEdit}>
          <p className={cn(styles.label, "chalk-soft")}>Prompt shown below these pictures</p>
          <input className={styles.input} value={title} maxLength={60} placeholder={prompt.defaultTitle} onChange={(e) => setTitle(e.target.value)} aria-label={`${label}: prompt title`} />
          <input className={styles.input} value={text} maxLength={120} placeholder={prompt.defaultText} onChange={(e) => setText(e.target.value)} aria-label={`${label}: prompt text`} />
          <div className={styles.photoBar}>
            <span className={cn(styles.hintSmall, "chalk-soft")}>Leave empty to use the original wording.</span>
            <button type="button" className={styles.smallButton} disabled={!dirty || prompt.busy} onClick={() => prompt.onSave(title, text)}>{prompt.busy ? "Saving…" : "Save prompt"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Slot({ name, groupLabel, custom, builtIn, busy, onReplace, onReset, onDetails, resetLabel = "Use built-in picture", captions = true }: {
  name: string; groupLabel: string; custom: PortfolioPhoto | null; builtIn: PortfolioPhoto | null; busy: boolean;
  onReplace: (e: ChangeEvent<HTMLInputElement>) => void; onReset: () => void; onDetails: (p: PortfolioPhoto) => void; resetLabel?: string;
  /** Show the caption field (pictures in "Little moments" show a caption under the photo). */
  captions?: boolean;
}) {
  const shown = custom ?? builtIn;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(shown?.title ?? "");
  const [alt, setAlt] = useState(shown?.alt ?? "");
  const [caption, setCaption] = useState(shown?.caption ?? "");
  return (
    <div className={styles.slot}>
      <p className={cn(styles.slotName, "chalk-soft")}>{name}</p>
      <div className={styles.slotThumb}>
        {shown ? <Image src={shown.src} alt={shown.alt} fill sizes="220px" style={{ objectFit: "cover" }} unoptimized={shown.src.startsWith("data:")} /> : null}
        {busy && <span className={cn(styles.slotBusy, "chalk-soft")}>Saving…</span>}
      </div>
      <p className={cn(styles.slotSource, "chalk-soft")}>{custom ? "Your picture" : "Built-in picture"}</p>
      <label className={cn(styles.smallButton, styles.replaceBtn)}>
        <input type="file" accept="image/*" className={styles.visuallyHidden} onChange={onReplace} aria-label={`Replace ${groupLabel} ${name}`} disabled={busy} />
        Replace
      </label>
      {captions && shown && <p className={cn(styles.slotCaption, "chalk-soft")}>{shown.caption ? `Caption: “${shown.caption}”` : "No caption: the photo fills the frame"}</p>}
      {shown && (
        <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide details" : captions ? "Caption & details" : "Details"}</button>
      )}
      {custom && <button type="button" className={cn(styles.linkButton, styles.dangerText, "chalk-soft")} onClick={onReset} disabled={busy}>{resetLabel}</button>}
      {open && shown && (
        <div className={styles.slotDetails}>
          {captions && (
            <label className={cn(styles.label, "chalk-soft")}>
              Caption under the photo (optional)
              <input className={styles.input} value={caption} maxLength={40} placeholder="e.g. First week" onChange={(e) => setCaption(e.target.value)} aria-label={`${groupLabel} ${name} caption`} />
              <span className={cn(styles.hintSmall, "chalk-soft")}>Leave empty and the photo fills the whole frame.</span>
            </label>
          )}
          <label className={cn(styles.label, "chalk-soft")}>Title (shown when a parent books this photo)<input className={styles.input} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className={cn(styles.label, "chalk-soft")}>Description for screen readers<input className={styles.input} value={alt} maxLength={160} onChange={(e) => setAlt(e.target.value)} /></label>
          <button
            type="button"
            className={styles.smallButton}
            disabled={busy || !title.trim()}
            onClick={() => onDetails({ ...shown, title: title.trim(), alt: alt.trim() || title.trim(), caption: captions ? caption.trim() : shown.caption })}
          >
            Save details
          </button>
        </div>
      )}
    </div>
  );
}
