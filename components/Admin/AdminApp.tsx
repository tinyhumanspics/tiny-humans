"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { themes, THEME_IDS, type TinyHumansTheme } from "@/config/themes";
import { portfolio as builtInPhotos, type PortfolioPhoto } from "@/config/portfolio";
import type { PhotoSetId, SiteSettings } from "@/lib/settings/types";
import { getAdminApi, preparePhoto, PROTOTYPE_PASSWORD } from "@/lib/admin/client";
import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import TinyHumansLogo from "@/components/TinyHumansLogo/TinyHumansLogo";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import AvailabilityPanel from "./AvailabilityPanel";
import LeadsPanel from "./LeadsPanel";
import styles from "./Admin.module.css";

type Status = "loading" | "signedOut" | "ready";
type Note = { kind: "ok" | "error"; text: string } | null;

const newId = () => `photo-${Math.random().toString(36).slice(2, 9)}`;
const titleFromFile = (name: string) =>
  name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "New photo";

export default function AdminApp() {
  const api = useMemo(() => getAdminApi(), []);
  const { applySettings } = useSiteSettings();
  const [status, setStatus] = useState<Status>("loading");
  const [storageReady, setStorageReady] = useState(true);
  const [authReady, setAuthReady] = useState(true);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  const load = async () => {
    const s = await api.getSettings();
    setSettings(s);
    applySettings(s);
    setStatus("ready");
  };

  useEffect(() => {
    api
      .session()
      .then((s) => {
        setStorageReady(s.storageConfigured);
        setAuthReady(s.authConfigured);
        if (s.authenticated) return load();
        setStatus("signedOut");
      })
      .catch(() => setStatus("signedOut"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "loading") return <p className={`${styles.loading} chalk-soft`}>Opening the owner area…</p>;
  if (status === "signedOut" || !settings) return <Login api={api} authReady={authReady} onSignedIn={load} />;

  const save = async (next: SiteSettings) => {
    const saved = await api.saveSettings(next);
    setSettings(saved);
    applySettings(saved);
    return saved;
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={`${styles.h1} chalk`}>Owner area</h1>
        <button
          type="button"
          className={`${styles.linkButton} chalk-soft`}
          onClick={async () => {
            await api.logout();
            setStatus("signedOut");
          }}
        >
          Sign out
        </button>
      </div>

      {api.mode === "prototype" && (
        <p className={`${styles.banner} chalk-soft`}>
          Prototype: changes are saved in this browser only, so you can preview them. On the real site they go live for every visitor.
        </p>
      )}
      {api.mode === "live" && !storageReady && (
        <p className={`${styles.bannerError} chalk-soft`} role="alert">
          Storage isn&apos;t connected yet, so changes can&apos;t be saved. Connect a Vercel Blob store to this project (see README).
        </p>
      )}

      <LeadsPanel api={api} />
      <ThemePanel settings={settings} onSave={save} prototype={api.mode === "prototype"} />
      <AvailabilityPanel api={api} />
      <PicturesPanel settings={settings} onSave={save} upload={(b) => api.uploadPhoto(b)} />
    </div>
  );
}

/* ---------------- login ---------------- */

function Login({ api, authReady, onSignedIn }: { api: ReturnType<typeof getAdminApi>; authReady: boolean; onSignedIn: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setError("Enter the owner password.");
    setBusy(true);
    setError(null);
    const res = await api.login(password);
    if (res.ok) await onSignedIn();
    else setError(res.error ?? "That password isn't right.");
    setBusy(false);
  };

  return (
    <ChalkBox className={styles.login} seed={801} wobble={3} strokeWidth={2.6}>
      <h1 className={`${styles.h1} chalk`}>Owner area</h1>
      <p className={`${styles.muted} chalk-soft`}>Sign in to change the website theme and photos.</p>
      {!authReady && (
        <p className={`${styles.bannerError} chalk-soft`}>The owner password isn&apos;t set up yet. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel (see README).</p>
      )}
      <form onSubmit={submit} className={styles.loginForm} noValidate>
        <label htmlFor="admin-password" className={`${styles.label} chalk-soft`}>
          Password
        </label>
        <input
          id="admin-password"
          className={styles.input}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "admin-password-error" : undefined}
        />
        {error && (
          <p id="admin-password-error" className={`${styles.error} chalk-soft`} role="alert">
            {error}
          </p>
        )}
        <ChalkButton type="submit" variant="solid" disabled={busy} seed={802}>
          {busy ? "Signing in…" : "Sign in"}
        </ChalkButton>
      </form>
      {api.mode === "prototype" && <p className={`${styles.hint} chalk-soft`}>Prototype password: {PROTOTYPE_PASSWORD}</p>}
    </ChalkBox>
  );
}

/* ---------------- theme ---------------- */

function ThemePanel({ settings, onSave, prototype }: { settings: SiteSettings; onSave: (s: SiteSettings) => Promise<SiteSettings>; prototype: boolean }) {
  const [busy, setBusy] = useState<TinyHumansTheme | null>(null);
  const [note, setNote] = useState<Note>(null);

  const choose = async (id: TinyHumansTheme) => {
    setBusy(id);
    setNote(null);
    try {
      await onSave({ ...settings, themeId: id });
      setNote({ kind: "ok", text: `${themes[id].label} theme is live.` });
    } catch (e) {
      setNote({ kind: "error", text: e instanceof Error ? e.message : "Couldn't change the theme." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="theme-title">
      <h2 id="theme-title" className={`${styles.h2} chalk`}>Website theme</h2>
      <p className={`${styles.muted} chalk-soft`}>Changes the logo, the opening animation, colors and decorations across the whole site.</p>
      <div className={styles.themes}>
        {THEME_IDS.map((id, i) => {
          const t = themes[id];
          const live = settings.themeId === id;
          return (
            <ChalkBox key={id} className={`${styles.themeCard} ${live ? styles.themeLive : ""}`} seed={820 + i} wobble={2.4} strokeWidth={live ? 3 : 2.2} color={live ? "var(--sun-yellow)" : "var(--chalk-white)"}>
              <div className={styles.themeLogo}>
                <TinyHumansLogo logo={t.logo} state="drawn" />
              </div>
              {live ? (
                <p className={`${styles.liveTag} chalk-soft`} aria-live="polite">Live now</p>
              ) : (
                <ChalkButton variant="outline" onClick={() => choose(id)} disabled={busy !== null} seed={830 + i} className={styles.themeButton}>
                  {busy === id ? "Switching…" : t.buttonLabel}
                </ChalkButton>
              )}
            </ChalkBox>
          );
        })}
      </div>
      {note && (
        <p className={`${note.kind === "ok" ? styles.ok : styles.error} chalk-soft`} role={note.kind === "error" ? "alert" : "status"}>
          {note.text}{" "}
          {note.kind === "ok" &&
            (prototype ? (
              <button type="button" className={styles.linkButton} onClick={() => window.location.reload()}>
                See the opening animation
              </button>
            ) : (
              <span>Visitors see it on their next page load.</span>
            ))}
        </p>
      )}
    </section>
  );
}

/* ---------------- pictures ---------------- */

type Upload = (b: Blob) => Promise<{ src: string }>;

function setPhotos(settings: SiteSettings, id: PhotoSetId): PortfolioPhoto[] {
  if (id === "default") return settings.photoSets.default ?? builtInPhotos;
  return settings.photoSets[id] ?? [];
}

const setLabel = (id: PhotoSetId) => `${themes[id].label} pictures`;

/** Picture sets: choose which one is on the site, and edit any of them. */
function PicturesPanel({ settings, onSave, upload }: { settings: SiteSettings; onSave: (s: SiteSettings) => Promise<SiteSettings>; upload: Upload }) {
  const [busy, setBusy] = useState<PhotoSetId | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [editing, setEditing] = useState<PhotoSetId>(settings.photoSetId);
  const [editorDirty, setEditorDirty] = useState(false);

  const choose = async (id: PhotoSetId) => {
    setBusy(id);
    setNote(null);
    try {
      await onSave({ ...settings, photoSetId: id });
      setNote({ kind: "ok", text: `${themes[id].label} pictures are on the site now.` });
    } catch (e) {
      setNote({ kind: "error", text: e instanceof Error ? e.message : "Couldn't switch the pictures." });
    } finally {
      setBusy(null);
    }
  };

  const openEditor = (id: PhotoSetId) => {
    if (id === editing) return;
    if (editorDirty && !window.confirm("You have unsaved changes to these pictures. Leave without saving?")) return;
    setEditorDirty(false);
    setEditing(id);
  };

  return (
    <section className={styles.section} aria-labelledby="pictures-title">
      <h2 id="pictures-title" className={`${styles.h2} chalk`}>Portfolio pictures</h2>
      <p className={`${styles.muted} chalk-soft`}>
        Keep a set of pictures for each season. Choosing a set swaps every portfolio photo on the site. It never changes on its own when you switch the theme.
      </p>

      <div className={styles.themes}>
        {THEME_IDS.map((id, i) => {
          const photos = setPhotos(settings, id);
          const live = settings.photoSetId === id;
          return (
            <ChalkBox key={id} className={`${styles.themeCard} ${live ? styles.themeLive : ""}`} seed={860 + i} wobble={2.4} strokeWidth={live ? 3 : 2.2} color={live ? "var(--sun-yellow)" : "var(--chalk-white)"}>
              <div className={styles.setPreview}>
                {photos.length ? (
                  photos.slice(0, 3).map((p) => <Image key={p.id + p.src.slice(-12)} src={p.src} alt="" width={p.width} height={p.height} sizes="80px" className={styles.setThumb} />)
                ) : (
                  <p className={`${styles.setEmpty} chalk-soft`}>No pictures yet</p>
                )}
              </div>
              <p className={`${styles.setName} chalk-soft`}>
                {themes[id].label}
                <span className={styles.setCount}> {photos.length} photo{photos.length === 1 ? "" : "s"}</span>
              </p>
              {live ? (
                <p className={`${styles.liveTag} chalk-soft`}>On the site now</p>
              ) : (
                <ChalkButton variant="outline" onClick={() => choose(id)} disabled={busy !== null || photos.length === 0} seed={870 + i} className={styles.themeButton}>
                  {busy === id ? "Switching…" : `${themes[id].label} Pictures`}
                </ChalkButton>
              )}
            </ChalkBox>
          );
        })}
      </div>
      {note && (
        <p className={`${note.kind === "ok" ? styles.ok : styles.error} chalk-soft`} role={note.kind === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}

      <div className={styles.editTabs} role="group" aria-label="Choose which pictures to edit">
        <span className={`${styles.label} chalk-soft`}>Edit:</span>
        {THEME_IDS.map((id) => (
          <button key={id} type="button" className={`${styles.tab} ${editing === id ? styles.tabActive : ""}`} aria-pressed={editing === id} onClick={() => openEditor(id)}>
            {themes[id].label}
          </button>
        ))}
      </div>

      <PhotoPanel key={editing} setId={editing} settings={settings} onSave={onSave} upload={upload} onDirtyChange={setEditorDirty} />
    </section>
  );
}

/* ---------------- one picture set ---------------- */

function PhotoPanel({
  setId,
  settings,
  onSave,
  upload,
  onDirtyChange,
}: {
  setId: PhotoSetId;
  settings: SiteSettings;
  onSave: (s: SiteSettings) => Promise<SiteSettings>;
  upload: Upload;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const saved = setPhotos(settings, setId);
  const isDefault = setId === "default";
  const isLive = settings.photoSetId === setId;
  const label = setLabel(setId);
  const [draft, setDraft] = useState<PortfolioPhoto[]>(saved);
  const [dirty, setDirtyState] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const addInput = useRef<HTMLInputElement>(null);

  const setDirty = (d: boolean) => {
    setDirtyState(d);
    onDirtyChange(d);
  };

  useEffect(() => {
    if (!dirty) setDraft(setPhotos(settings, setId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, setId]);

  const edit = (next: PortfolioPhoto[]) => {
    setDraft(next);
    setDirty(true);
    setNote(null);
  };
  const update = (i: number, patch: Partial<PortfolioPhoto>) => edit(draft.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j], next[i]];
    edit(next);
  };

  const prepareAndUpload = async (file: File) => {
    const { blob, width, height } = await preparePhoto(file);
    const { src } = await upload(blob);
    return { src, width, height };
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("Adding photos…");
    setNote(null);
    const added: PortfolioPhoto[] = [];
    try {
      for (const file of Array.from(files)) {
        const img = await prepareAndUpload(file);
        const title = titleFromFile(file.name);
        added.push({ id: newId(), ...img, title, alt: title });
      }
      edit([...draft, ...added]);
      setNote({ kind: "ok", text: `${added.length} photo${added.length === 1 ? "" : "s"} added. Press Save to keep them.` });
    } catch (e) {
      if (added.length) edit([...draft, ...added]);
      setNote({ kind: "error", text: e instanceof Error ? e.message : "Couldn't add that photo." });
    } finally {
      setBusy(null);
      if (addInput.current) addInput.current.value = "";
    }
  };

  const replace = async (i: number, file: File | undefined) => {
    if (!file) return;
    setBusy("Replacing photo…");
    try {
      update(i, await prepareAndUpload(file));
    } catch (e) {
      setNote({ kind: "error", text: e instanceof Error ? e.message : "Couldn't replace that photo." });
    } finally {
      setBusy(null);
    }
  };

  const publish = async (photos: PortfolioPhoto[] | null, okText: string) => {
    if (isLive && !isDefault && !photos?.length) {
      setNote({ kind: "error", text: "These pictures are on the site, so the set can't be empty. Switch to another set first." });
      return;
    }
    setBusy("Saving…");
    try {
      const photoSets = { ...settings.photoSets };
      if (photos?.length) photoSets[setId] = photos;
      else delete photoSets[setId];
      await onSave({ ...settings, photoSets });
      setDirty(false);
      setNote({ kind: "ok", text: okText });
    } catch (e) {
      setNote({ kind: "error", text: e instanceof Error ? e.message : "Couldn't save the photos." });
    } finally {
      setBusy(null);
    }
  };

  const minPhotos = isDefault || isLive ? 1 : 0;

  return (
    <div className={styles.editor}>
      <h3 className={`${styles.h3} chalk-soft`}>
        {label}
        {isLive && <span className={styles.liveSmall}> (on the site now)</span>}
      </h3>
      <p className={`${styles.muted} chalk-soft`}>
        Shown on the home page in this order, in groups of three. The title is what parents see when they book a photo with &ldquo;Book a memory like this one&rdquo;.
      </p>

      {draft.length === 0 ? (
        <div className={styles.emptySet}>
          <p className="chalk-soft">No {label.toLowerCase()} yet. Add new photos, or start from the Original pictures and replace the ones you want.</p>
          <button type="button" className={styles.smallButton} onClick={() => edit(setPhotos(settings, "default").map((p) => ({ ...p })))}>
            Start with a copy of the Original pictures
          </button>
        </div>
      ) : (
        <ol className={styles.photoList}>
          {draft.map((p, i) => (
            <li key={p.id + i} className={styles.photoRow}>
              <div className={styles.photoThumb}>
                <Image src={p.src} alt="" width={p.width} height={p.height} sizes="120px" className={styles.photoImg} />
                <span className={`${styles.photoNum} chalk-soft`}>{i + 1}</span>
              </div>
              <div className={styles.photoFields}>
                <label className={`${styles.label} chalk-soft`} htmlFor={`title-${setId}-${i}`}>Title</label>
                <input id={`title-${setId}-${i}`} className={styles.input} value={p.title} maxLength={80} onChange={(e) => update(i, { title: e.target.value })} />
                <label className={`${styles.label} chalk-soft`} htmlFor={`caption-${setId}-${i}`}>
                  Caption under the photo <span className={styles.optional}>(optional)</span>
                </label>
                <input id={`caption-${setId}-${i}`} className={styles.input} value={p.caption ?? ""} maxLength={60} onChange={(e) => update(i, { caption: e.target.value })} />
                <label className={`${styles.label} chalk-soft`} htmlFor={`alt-${setId}-${i}`}>Description for screen readers</label>
                <input id={`alt-${setId}-${i}`} className={styles.input} value={p.alt} maxLength={200} onChange={(e) => update(i, { alt: e.target.value })} />
              </div>
              <div className={styles.photoActions}>
                <button type="button" className={styles.smallButton} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move photo ${i + 1} up`}>↑ Up</button>
                <button type="button" className={styles.smallButton} onClick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label={`Move photo ${i + 1} down`}>↓ Down</button>
                <label className={styles.smallButton}>
                  Replace
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" aria-label={`Replace photo ${i + 1}`} onChange={(e) => replace(i, e.target.files?.[0])} />
                </label>
                <button
                  type="button"
                  className={`${styles.smallButton} ${styles.danger}`}
                  disabled={draft.length <= minPhotos}
                  onClick={() => {
                    if (window.confirm(`Remove "${p.title}" from the ${label.toLowerCase()}?`)) edit(draft.filter((_, j) => j !== i));
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className={styles.photoBar}>
        <label className={styles.addButton}>
          <span className="chalk-soft">+ Add photos</span>
          <input ref={addInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="visually-hidden" aria-label={`Add photos to the ${label.toLowerCase()}`} onChange={(e) => addPhotos(e.target.files)} />
        </label>
        <div className={styles.photoBarRight}>
          {dirty && (
            <button type="button" className={`${styles.linkButton} chalk-soft`} onClick={() => { setDraft(saved); setDirty(false); setNote(null); }}>
              Discard changes
            </button>
          )}
          <ChalkButton variant="solid" onClick={() => publish(draft, isLive ? "Saved. The new pictures are on the site." : `Saved. Choose "${themes[setId].label} Pictures" above when you want them on the site.`)} disabled={!dirty || busy !== null} seed={850}>
            Save {themes[setId].label.toLowerCase()} pictures
          </ChalkButton>
        </div>
      </div>

      {busy && <p className={`${styles.muted} chalk-soft`} aria-live="polite">{busy}</p>}
      {dirty && !busy && <p className={`${styles.unsaved} chalk-soft`}>You have unsaved changes.</p>}
      {note && (
        <p className={`${note.kind === "ok" ? styles.ok : styles.error} chalk-soft`} role={note.kind === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}

      {isDefault && settings.photoSets.default && (
        <button type="button" className={`${styles.linkButton} ${styles.restore} chalk-soft`} onClick={() => { if (window.confirm("Go back to the original placeholder photos?")) publish(null, "Original photos restored."); }}>
          Restore the original photos
        </button>
      )}
      {!isDefault && !isLive && settings.photoSets[setId] && (
        <button type="button" className={`${styles.linkButton} ${styles.restore} chalk-soft`} onClick={() => { if (window.confirm(`Delete all ${label.toLowerCase()}?`)) publish(null, `${themes[setId].label} pictures cleared.`); }}>
          Clear the {label.toLowerCase()}
        </button>
      )}
    </div>
  );
}
