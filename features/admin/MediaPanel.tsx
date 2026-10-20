"use client";

import { useState, type ChangeEvent } from "react";
import { themes, THEME_IDS, type TinyHumansTheme } from "@/config/themes";
import { BUILT_IN, emptyThemeMedia, LANDING_FROM_ABOUT, MEDIA_GROUPS, type ThemeMedia } from "@/config/media";
import type { PortfolioPhoto } from "@/config/portfolio";
import type { SiteSettings } from "@/lib/settings/types";
import { preparePhoto } from "@/lib/admin/client";
import MediaSections from "./MediaSections";
import Slot from "./MediaSlot";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

type Upload = (b: Blob) => Promise<{ src: string }>;
type Note = { kind: "ok" | "error"; text: string } | null;
type SlotPath = ["title" | "landing" | "about" | "email", number];

const newId = () => `photo-${Math.random().toString(36).slice(2, 9)}`;
const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "New photo";
const clone = (m: ThemeMedia): ThemeMedia => JSON.parse(JSON.stringify(m));
const ABOUT_NOTE = "Using the About Us photo";

/**
 * Photos / Media: every editable picture, grouped by WHERE it appears on the
 * website, for one theme at a time. Each theme is stored independently.
 */
export default function MediaPanel({ settings, onSave, upload }: { settings: SiteSettings; onSave: (s: SiteSettings) => Promise<SiteSettings>; upload: Upload }) {
  const [themeId, setThemeId] = useState<TinyHumansTheme>(settings.themeId);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const media = settings.media[themeId] ?? emptyThemeMedia();
  /** Other themes show the Original theme's picture wherever they have none of their own. */
  const base = themeId === "default" ? undefined : settings.media.default;
  const baseLabel = themes.default.label;
  const back = (where: string, inherited: PortfolioPhoto | null | undefined, otherwise: string) => `${where} ${inherited ? `now shows the ${baseLabel} theme's picture.` : otherwise}`;
  const live = themeId === settings.themeId;
  // empty landing slots: the Original theme's landing photo, else the matching About Us photo (as on the website)
  const landingFromAbout = LANDING_FROM_ABOUT.map((a) => media.about?.[a] ?? base?.about?.[a] ?? null);
  const landingInherited = MEDIA_GROUPS.landing.slots.map((_, i) => base?.landing?.[i] ?? landingFromAbout[i]);
  const landingNotes = MEDIA_GROUPS.landing.slots.map((_, i) => (!base?.landing?.[i] && landingFromAbout[i] ? ABOUT_NOTE : undefined));
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
    return { id: newId(), src, width, height, title, alt: previous?.alt || title, caption: previous?.caption ?? "", spanish: previous?.spanish ?? null };
  };

  const setSlot = async (path: SlotPath, photo: PortfolioPhoto | null, okText: string) => {
    const next = clone(media);
    if (path[0] === "title") next.title[path[1]] = photo;
    else if (path[0] === "landing") next.landing[path[1]] = photo;
    else if (path[0] === "about") next.about[path[1]] = photo;
    else (next.email ??= emptyThemeMedia().email)[path[1]] = photo;
    await saveMedia(next, path.join("-"), okText);
  };

  const replace = async (path: SlotPath, current: PortfolioPhoto | null, slotName: string, e: ChangeEvent<HTMLInputElement>) => {
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
      <p className={cn(styles.muted, "chalk-soft")}>Each theme has its own pictures. In the other themes, any spot you leave empty shows the {themes.default.label} theme&apos;s picture, so you only need to replace the ones you want different. Which theme visitors see is set in <b>Theme</b>.</p>
      <div className={styles.editTabs} role="group" aria-label="Theme to edit">
        {THEME_IDS.map((id) => (
          <button key={id} type="button" className={cn(styles.tab, themeId === id ? styles.tabActive : "")} aria-pressed={themeId === id} onClick={() => { setThemeId(id); setNote(null); }}>
            {themes[id].label}{id === settings.themeId ? " · live" : ""}
          </button>
        ))}
      </div>
      <p className={cn(styles.editingFor, "chalk-soft")} aria-live="polite">
        Editing media for: <b>{label}</b> {live ? <span className={styles.mediaLiveTag}>live on the site now</span> : <span className={styles.mediaOffTag}>not the active theme</span>}
      </p>

      <MediaGroupBlock label={MEDIA_GROUPS.title.label} where={`${MEDIA_GROUPS.title.where} These two are shown without captions.`}>
        {[0, 1].map((i) => (
          <Slot key={`t${i}-${themeId}-${media.title[i]?.id ?? "built-in"}`} name={`Image ${i + 1}`} groupLabel={MEDIA_GROUPS.title.label} custom={media.title[i]} inherited={base?.title[i]} inheritedLabel={baseLabel} builtIn={BUILT_IN.title[i]} busy={busy === `title-${i}`}
            onReplace={(e) => replace(["title", i], media.title[i], `${MEDIA_GROUPS.title.label} · Image ${i + 1}`, e)}
            onReset={() => setSlot(["title", i], null, back(`${MEDIA_GROUPS.title.label} · Image ${i + 1}`, base?.title[i], "is back to the built-in picture."))}
            resetLabel={base?.title[i] ? `Use the ${baseLabel} picture` : undefined}
            onDetails={(p) => setSlot(["title", i], p, "Details saved.")} captions={false} />
        ))}
      </MediaGroupBlock>

      <FixedPlaceholderGroup
        definition={MEDIA_GROUPS.landing}
        kind="landing"
        photos={media.landing}
        inherited={landingInherited}
        inheritedNotes={landingNotes}
        inheritedLabel={baseLabel}
        themeId={themeId}
        busy={busy}
        replace={replace}
        setSlot={setSlot}
      />

      <FixedPlaceholderGroup
        definition={MEDIA_GROUPS.about}
        kind="about"
        photos={media.about}
        inherited={base?.about}
        inheritedLabel={baseLabel}
        themeId={themeId}
        busy={busy}
        replace={replace}
        setSlot={setSlot}
      />

      <MediaGroupBlock label={MEDIA_GROUPS.email.label} where={MEDIA_GROUPS.email.where}>
        {MEDIA_GROUPS.email.slots.map((name, i) => {
          const own = media.email?.[i] ?? null;
          const fromBase = base?.email?.[i] ?? null;
          const fromAbout = media.about[0] ?? base?.about[0] ?? null;
          const inherited = fromBase ?? fromAbout;
          return (
            <Slot key={`email-${i}-${themeId}-${own?.id ?? "empty"}`} name={name} groupLabel={MEDIA_GROUPS.email.label} custom={own} inherited={inherited}
              inheritedNote={fromBase ? `Same as the ${baseLabel} theme` : ABOUT_NOTE} round builtIn={null} busy={busy === `email-${i}`}
              onReplace={(e) => replace(["email", i], own, `${MEDIA_GROUPS.email.label} · ${name}`, e)}
              onReset={() => setSlot(["email", i], null, `${MEDIA_GROUPS.email.label} · ${name} removed. ${inherited ? (fromBase ? `The email uses the ${baseLabel} theme's photo again.` : "The email uses the About Us photo again.") : "The email shows no photo."}`)}
              onDetails={(ph) => setSlot(["email", i], ph, "Photo details saved.")}
              resetLabel="Remove picture" captions={false} />
          );
        })}
      </MediaGroupBlock>

      <MediaSections media={media} base={base} themeId={themeId} isOriginal={themeId === "default"} themeLabel={label} baseLabel={baseLabel} spanishLive={settings.spanishPublished}
        busy={busy} setBusy={setBusy} saveMedia={saveMedia} toPhoto={toPhoto}
        fail={(err, fallback) => setNote({ kind: "error", text: err instanceof Error ? err.message : fallback })} />
      {note && <p className={cn(note.kind === "ok" ? styles.ok : styles.error, styles.mediaNote)} role={note.kind === "error" ? "alert" : "status"}>{note.text}</p>}
    </section>
  );
}

function FixedPlaceholderGroup({ definition, kind, photos, inherited, inheritedNotes, inheritedLabel, themeId, busy, replace, setSlot }: {
  definition: { label: string; where: string; slots: string[] };
  kind: "landing" | "about";
  photos: (PortfolioPhoto | null)[];
  /** The Original theme's pictures (shown in empty slots of other themes). */
  inherited?: (PortfolioPhoto | null)[];
  /** Per slot: replaces "Same as the … theme" (e.g. a landing slot showing the About Us photo). */
  inheritedNotes?: (string | undefined)[];
  inheritedLabel: string;
  themeId: TinyHumansTheme;
  busy: string | null;
  replace: (path: SlotPath, current: PortfolioPhoto | null, slotName: string, e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  setSlot: (path: SlotPath, photo: PortfolioPhoto | null, okText: string) => Promise<void>;
}) {
  return (
    <MediaGroupBlock label={definition.label} where={`${definition.where} These photos are shown without captions.`}>
      {definition.slots.map((name, i) => (
        <Slot
          key={`${kind}-${i}-${themeId}-${photos[i]?.id ?? "empty"}`}
          name={name}
          groupLabel={definition.label}
          custom={photos[i] ?? null}
          inherited={inherited?.[i]}
          inheritedLabel={inheritedLabel}
          inheritedNote={inheritedNotes?.[i]}
          builtIn={null}
          busy={busy === `${kind}-${i}`}
          onReplace={(e) => replace([kind, i], photos[i] ?? null, `${definition.label} · ${name}`, e)}
          onReset={() => setSlot([kind, i], null, `${definition.label} · ${name} removed. ${inheritedNotes?.[i] ? "The About Us photo is showing again." : inherited?.[i] ? `The ${inheritedLabel} theme's picture is showing again.` : "The placeholder is showing again."}`)}
          onDetails={(p) => setSlot([kind, i], p, "Photo details saved.")}
          resetLabel="Remove picture"
          captions={false}
        />
      ))}
    </MediaGroupBlock>
  );
}

function MediaGroupBlock({ label, where, children }: { label: string; where: string; children: React.ReactNode }) {
  return (
    <div className={styles.mediaGroup}>
      <h3 className={cn(styles.mediaGroupTitle, "chalk")}>{label}</h3>
      <p className={cn(styles.hintSmall, "chalk-soft")}>{where}</p>
      <div className={styles.slotGrid}>{children}</div>
    </div>
  );
}
