"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import styles from "@/features/admin/Admin.module.css";
import { cn } from "@/lib/cn";
import { shootsApi } from "@/lib/shoots/client";
import { normalizeLink, platformOf } from "@/lib/shoots/links";
import type { InspoGroup, InspoItem } from "@/lib/shoots/types";
import { saveText, useAutosave } from "./useAutosave";
import { useTwoTap } from "./useTwoTap";
import css from "./Shoots.module.css";

const WORDS = {
  inspo: { label: "What's the shot?", placeholder: "e.g. Basket nap, sleepy curl", note: "+ A shot with no photo", tile: "Shot idea", empty: "Nothing here yet." },
  bts: { label: "What's the idea?", placeholder: "e.g. Camera-back reveal", note: "+ Write an idea (no photo)", tile: "Idea", empty: "No ideas yet." },
} as const;

/**
 * One group of a shoot folder (the family's inspo, or our BTS-on-phones ideas): paste a link, add a shot with no
 * photo, then a card per item with "What's the shot?" and Remove. Photos and videos arrive in slice 4 (drop zone).
 */
export default function InspoDrop({
  shootKey,
  group,
  items,
  onAdd,
  onRemove,
}: {
  shootKey: string;
  group: InspoGroup;
  items: InspoItem[];
  onAdd: (item: InspoItem) => void;
  onRemove: (id: string) => void;
}) {
  const w = WORDS[group];
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState<"link" | "note" | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const linkId = `link-${group}`;

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
        <ul className={css.inspoGrid}>
          {items.map((item) => (
            <InspoCard key={item.id} shootKey={shootKey} item={item} focus={focusId === item.id} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </>
  );
}

function Tile({ item }: { item: InspoItem }) {
  const w = WORDS[item.group];
  if (item.type === "link" && item.linkUrl) {
    return (
      <a className={css.linkVis} href={item.linkUrl} target="_blank" rel="noopener noreferrer">
        {item.platform ?? "Link"}
        <small>{item.linkUrl}</small>
        <span className={styles.visuallyHidden}> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <div className={cn(css.linkVis, css.noteVis)}>
      {item.type === "note" ? w.tile : "Photo"}
      <small>{item.type === "note" ? "no photo" : "coming with photo uploads"}</small>
    </div>
  );
}

function InspoCard({ shootKey, item, focus, onRemove }: { shootKey: string; item: InspoItem; focus: boolean; onRemove: (id: string) => void }) {
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
  const what = caption.trim() || (item.type === "link" ? `${item.platform ?? "link"} link` : "this one");
  return (
    <li className={cn(css.card, css.inspoCard)}>
      <Tile item={item} />
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
      <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={remove} disabled={removing}>
        {removing ? "Removing…" : twoTap.confirming ? "Tap again to remove" : "Remove"}
        <span className={styles.visuallyHidden}> ({what})</span>
      </button>
      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
    </li>
  );
}
