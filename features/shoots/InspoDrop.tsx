"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import styles from "@/features/admin/Admin.module.css";
import { preparePhoto } from "@/lib/admin/client";
import { cn } from "@/lib/cn";
import { shootsApi } from "@/lib/shoots/client";
import { normalizeLink, platformOf } from "@/lib/shoots/links";
import { byKind, inShownOrder, KIND_LABEL } from "@/lib/shoots/kinds";
import { hasCover, playsHere } from "@/lib/shoots/players";
import { picksWho, toggleWho, WHO_ALL, type ShootPerson } from "@/lib/shoots/people";
import type { InspoGroup, InspoItem } from "@/lib/shoots/types";
import InspoLightbox, { viewerItems } from "./InspoLightbox";
import { saveText, useAutosave } from "./useAutosave";
import { useTwoTap } from "./useTwoTap";
import css from "./Shoots.module.css";

const WORDS = {
  inspo: { label: "What's the shot?", placeholder: "e.g. Basket nap, sleepy curl", note: "+ A shot with no photo", tile: "Shot idea", empty: "Nothing here yet.", drop: "Drop inspo photos here" },
  bts: { label: "What's the idea?", placeholder: "e.g. Camera-back reveal", note: "+ Write an idea (no photo)", tile: "Idea", empty: "No ideas yet.", drop: "Drop a reference photo" },
} as const;

const isVisual = (i: InspoItem) => (i.type === "image" || i.type === "video") && Boolean(i.mediaUrl);

/**
 * One group of a shoot folder (the family's inspo, or our BTS-on-phones ideas): drop photos (or pick them on the
 * phone; shrunk to 2000 px before upload), paste a link, add a shot with no photo, then a card per item with
 * "What's the shot?" and Remove. Tap a photo to see it full screen. Videos: paste the link (owner, Nov 10: no video uploads);
 * Instagram, TikTok, YouTube and Vimeo links play in the same viewer (owner, Nov 11).
 */
export default function InspoDrop({
  shootKey,
  group,
  items,
  onAdd,
  onRemove,
  people = [],
}: {
  shootKey: string;
  group: InspoGroup;
  items: InspoItem[];
  onAdd: (item: InspoItem) => void;
  onRemove: (id: string) => void;
  /** The booking's babies and family: shot ideas then say who's in them (twins, family shoots). */
  people?: ShootPerson[];
}) {
  const w = WORDS[group];
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState<"link" | "note" | "upload" | null>(null);
  const [over, setOver] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const linkId = `link-${group}`;
  const photos = viewerItems(inShownOrder(items));
  const kinds = byKind(items);

  const addFiles = async (list: FileList | File[]) => {
    const files = [...list];
    const pictures = files.filter((f) => f.type.startsWith("image/"));
    const skipped = files.length - pictures.length;
    if (!pictures.length) {
      setMessage({ text: skipped ? "Videos aren't uploaded here: paste the link to the video instead." : "Those weren't photos.", error: true });
      return;
    }
    setBusy("upload");
    let added = 0;
    const failed: string[] = [];
    for (const [i, file] of pictures.entries()) {
      setMessage({ text: `Uploading ${i + 1} of ${pictures.length}…`, error: false });
      try {
        const item = await shootsApi.uploadPhoto(shootKey, group, await preparePhoto(file));
        onAdd(item);
        added += 1;
      } catch (err) {
        failed.push(`${file.name || "a photo"}: ${(err as Error).message}`);
      }
    }
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
    const parts = [
      added ? `${added} ${added === 1 ? "photo" : "photos"} added. Write what each one is below.` : "",
      skipped ? "Videos aren't uploaded here: paste the link instead." : "",
      failed.length ? `Not added: ${failed.join("; ")}` : "",
    ].filter(Boolean);
    setMessage({ text: parts.join(" "), error: failed.length > 0 && added === 0 });
  };

  const drop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOver(false);
    if (busy) return;
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  };

  const addLink = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const url = normalizeLink(link);
    const platform = url ? platformOf(url) : null;
    if (!url || !platform) {
      setMessage({ text: "That doesn't look like a web link. Copy it from the app's Share button and paste it here.", error: true });
      linkRef.current?.focus();
      return;
    }
    setBusy("link");
    try {
      const item = await shootsApi.addLink(shootKey, group, url);
      onAdd(item);
      setLink("");
      setMessage({ text: `${item.platform ?? "Link"} link added. Write what it is below.`, error: false });
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setBusy(null);
    }
  };

  const addNote = async () => {
    setBusy("note");
    setMessage(null);
    try {
      const item = await shootsApi.addNote(shootKey, group);
      onAdd(item);
      setFocusId(item.id);
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className={cn(css.card, css.dropCard)}>
        <label
          className={cn(css.dropZone, group === "bts" ? css.dropZoneSmall : "", over ? css.dropZoneOver : "")}
          onDragEnter={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className={styles.visuallyHidden}
            disabled={busy !== null}
            onChange={(e) => e.target.files && void addFiles(e.target.files)}
          />
          <span className={css.dropBig}>{busy === "upload" ? "Uploading…" : w.drop}</span>
          <span className={cn(css.dropSmall, "chalk-soft")}>or tap to choose from your phone · for videos, paste a link</span>
        </label>
        <form onSubmit={addLink} noValidate>
          <label className={cn(styles.label, "chalk-soft")} htmlFor={linkId}>Or paste a link</label>
          <div className={css.linkRow}>
            <input
              ref={linkRef}
              id={linkId}
              className={styles.input}
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="Instagram, TikTok, Pinterest or YouTube link"
              value={link}
              aria-invalid={message?.error ? true : undefined}
              aria-describedby={`${linkId}-msg`}
              onChange={(e) => {
                setLink(e.target.value);
                if (message?.error) setMessage(null);
              }}
            />
            <button className={styles.smallButton} type="submit" disabled={busy !== null}>
              {busy === "link" ? "Adding…" : "Add"}
            </button>
          </div>
          <p id={`${linkId}-msg`} className={cn(css.formMsg, message?.error ? css.formError : "", "chalk-soft")} role="status">
            {message?.text ?? ""}
          </p>
        </form>
        <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={addNote} disabled={busy !== null}>
          {busy === "note" ? "Adding…" : w.note}
        </button>
      </div>

      {items.length === 0 ? (
        <p className={cn(styles.hintSmall, "chalk-soft")}>{w.empty}</p>
      ) : (
        // photos, then videos, then ideas and links: never mixed (owner, Nov 12)
        kinds.map((k) => (
          <div key={k.kind}>
            {kinds.length > 1 && <p className={cn(css.kindH, "chalk-soft")}>{KIND_LABEL[k.kind]}</p>}
            <ul className={css.inspoGrid}>
              {k.items.map((item) => (
                <InspoCard key={item.id} shootKey={shootKey} item={item} focus={focusId === item.id} onRemove={onRemove} onOpen={() => setViewing(photos.findIndex((p) => p.id === item.id))} people={group === "inspo" && picksWho(people) ? people : null} />
              ))}
            </ul>
          </div>
        ))
      )}
      {viewing !== null && viewing >= 0 && photos.length > 0 && (
        <InspoLightbox photos={photos} index={Math.min(viewing, photos.length - 1)} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </>
  );
}

/** The picture part of a card: the photo (tap = full screen), a video (tap = plays here), the link, or "Shot idea · no photo". */
export function InspoTile({ item, onOpen, linkHint }: { item: InspoItem; onOpen: () => void; linkHint?: string }) {
  const w = WORDS[item.group];
  if (isVisual(item)) {
    return (
      <button type="button" className={css.thumb} onClick={onOpen}>
        {/* eslint-disable-next-line @next/next/no-img-element -- owner-only photos: never through the public image optimizer */}
        <img src={item.mediaUrl!} alt="" loading="lazy" />
        <span className={styles.visuallyHidden}>See {item.caption || "this photo"} big</span>
      </button>
    );
  }
  if (item.type === "link" && playsHere(item.linkUrl)) return <PlayCard link={item.linkUrl} platform={item.platform ?? "Video"} caption={item.caption} onOpen={onOpen} />;
  if (item.type === "link" && item.linkUrl) {
    return (
      <a className={css.linkVis} href={item.linkUrl} target="_blank" rel="noopener noreferrer">
        {item.platform ?? "Link"}
        <small>{linkHint ?? item.linkUrl}</small>
        <span className={styles.visuallyHidden}> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <div className={cn(css.linkVis, css.noteVis)}>
      {w.tile}
      <small>no photo</small>
    </div>
  );
}

/**
 * A video link's card: ▶ + the app's name; Instagram and YouTube also show the video's cover picture (owner, Nov 12:
 * "so I know which one it is"), fetched through our server. No picture (TikTok, private, the app said no) = the ▶ card.
 */
function PlayCard({ link, platform, caption, onOpen }: { link: string; platform: string; caption: string; onOpen: () => void }) {
  const [cover, setCover] = useState<"loading" | "shown" | "none">(() => (hasCover(link) ? "loading" : "none"));
  return (
    <button type="button" className={cn(css.linkVis, css.playVis, cover === "shown" ? css.withCover : "")} onClick={onOpen}>
      {cover !== "none" && (
        // eslint-disable-next-line @next/next/no-img-element -- owner-only picture from our own route, never the public optimizer
        <img
          className={css.cover}
          src={`/api/admin/shoots/cover?${new URLSearchParams({ link })}`}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setCover("shown")}
          onError={() => setCover("none")}
        />
      )}
      <span className={css.playIcon} aria-hidden="true" />
      <span className={css.app}>{platform}</span>
      <small>Play here</small>
      <span className={styles.visuallyHidden}> ({caption || "this video"})</span>
    </button>
  );
}

function InspoCard({ shootKey, item, focus, onRemove, onOpen, people }: { shootKey: string; item: InspoItem; focus: boolean; onRemove: (id: string) => void; onOpen: () => void; people: ShootPerson[] | null }) {
  const w = WORDS[item.group];
  const [caption, setCaption] = useState(item.caption);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const twoTap = useTwoTap();
  const save = useCallback(async (value: string) => {
    await shootsApi.saveCaption(shootKey, item.id, value);
  }, [shootKey, item.id]);
  const autosave = useAutosave(save);

  useEffect(() => {
    if (!focus) return;
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ block: "center" });
  }, [focus]);

  const remove = () =>
    twoTap.tap(async () => {
      autosave.cancel();
      setRemoving(true);
      setError(null);
      try {
        await shootsApi.removeInspo(shootKey, item.id);
        onRemove(item.id);
      } catch (err) {
        setError((err as Error).message);
        setRemoving(false);
        twoTap.reset();
      }
    });

  const id = `c-${item.id}`;
  const status = saveText(autosave.state);
  const what = caption.trim() || (item.type === "link" ? `${item.platform ?? "link"} link` : item.type === "image" ? "this photo" : "this one");
  return (
    <li className={cn(css.card, css.inspoCard)}>
      <InspoTile item={{ ...item, caption }} onOpen={onOpen} />
      <label className={cn(styles.label, "chalk-soft")} htmlFor={id}>{w.label}</label>
      <input
        ref={inputRef}
        id={id}
        className={styles.input}
        value={caption}
        maxLength={500}
        placeholder={w.placeholder}
        onChange={(e) => {
          setCaption(e.target.value);
          autosave.queue(e.target.value);
        }}
        onBlur={() => void autosave.flush()}
      />
      <p className={cn(css.cardStatus, autosave.state.kind === "error" ? css.formError : "", "chalk-soft")} role="status">
        {status === "Saved" ? "" : status}
      </p>
      {people && <WhoPicker shootKey={shootKey} item={item} people={people} />}
      <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={remove} disabled={removing}>
        {removing ? "Removing…" : twoTap.confirming ? "Tap again to remove" : "Remove"}
        <span className={styles.visuallyHidden}> ({what})</span>
      </button>
      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
    </li>
  );
}

/**
 * "Who's in it?" on a shot idea (owner, Nov 10: twins → each baby and both; family → everyone, mom and dad, dad and
 * brother…). Each tap saves; the day sheet groups the shots by who's in them.
 */
function WhoPicker({ shootKey, item, people }: { shootKey: string; item: InspoItem; people: ShootPerson[] }) {
  const [who, setWho] = useState<string[]>(item.who);
  const [error, setError] = useState(false);
  const latest = useRef(0);
  const labelId = `who-${item.id}`;
  const tap = async (key: string) => {
    const before = who;
    const next = toggleWho(who, key, people);
    setWho(next);
    setError(false);
    const call = ++latest.current;
    try {
      await shootsApi.saveWho(shootKey, item.id, next);
    } catch {
      // only the last tap's answer counts
      if (call !== latest.current) return;
      setWho(before);
      setError(true);
    }
  };
  const chips = [{ key: WHO_ALL, label: "Everyone" }, ...people];
  return (
    <div className={css.whoPick}>
      <p id={labelId} className={cn(css.whoLabel, "chalk-soft")}>Who&apos;s in it?</p>
      <div className={css.whoChips} role="group" aria-labelledby={labelId}>
        {chips.map((p) => (
          <button key={p.key} type="button" className={css.whoChip} aria-pressed={who.includes(p.key)} onClick={() => void tap(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      {error && <p className={cn(css.cardStatus, css.formError, "chalk-soft")} role="alert">Couldn&apos;t save who&apos;s in it. Tap again.</p>}
    </div>
  );
}
