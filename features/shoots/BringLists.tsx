"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "@/features/admin/Admin.module.css";
import { cn } from "@/lib/cn";
import { shootsApi, ShootsApiError } from "@/lib/shoots/client";
import type { BringSection } from "@/lib/shoots/types";
import NotReady from "./NotReady";
import ShootsTabs from "./ShootsTabs";
import { saveText, useAutosave, type SaveState } from "./useAutosave";
import { useAutoHeight } from "./useAutoHeight";
import { useTwoTap } from "./useTwoTap";
import css from "./Shoots.module.css";

/** /admin/shoots/bring: the sections every day sheet lists under "What to bring". Changes save by themselves. */
export default function BringLists() {
  const [sections, setSections] = useState<BringSection[] | null>(null);
  const [error, setError] = useState<ShootsApiError | null>(null);
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    shootsApi
      .bring()
      .then(setSections)
      .catch((e: ShootsApiError) => setError(e));
  }, []);

  const onState = useCallback((id: string, state: SaveState) => setStates((s) => (s[id]?.kind === state.kind ? s : { ...s, [id]: state })), []);

  const add = async () => {
    setAdding(true);
    setNote(null);
    try {
      const section = await shootsApi.addSection();
      setSections((s) => [...(s ?? []), section]);
      setFocusId(section.id);
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const removed = (id: string) => {
    setSections((s) => (s ?? []).filter((x) => x.id !== id));
    setStates(({ [id]: _gone, ...rest }) => rest);
    setNote("Section removed.");
    addRef.current?.focus();
  };

  // one line for the whole page, the most urgent first
  const all = Object.values(states);
  const pageState: SaveState =
    all.find((s) => s.kind === "error") ??
    all.find((s) => s.kind === "retrying") ??
    all.find((s) => s.kind === "saving") ??
    all.find((s) => s.kind === "saved") ?? { kind: "idle" };

  return (
    <div>
      <div className={css.top}>
        <p className={cn(styles.muted, "chalk-soft")}>
          Write this once. Every section shows up on every day sheet under &quot;What to bring&quot;. Backdrops and booked add-ons
          come from each booking, and anything for one family goes in their folder.
        </p>
      </div>
      <ShootsTabs current="bring" />

      {error?.notReady ? (
        <NotReady />
      ) : error ? (
        <p className={cn(styles.error, "chalk-soft")} role="alert">{error.message}</p>
      ) : !sections ? (
        <p className={cn(styles.hintSmall, "chalk-soft")} role="status">Loading…</p>
      ) : (
        <>
          <div className={css.sections}>
            {sections.length === 0 && <p className={cn(styles.muted, "chalk-soft")}>No sections yet. Add one for what you bring to every shoot.</p>}
            {sections.map((s) => (
              <SectionCard key={s.id} section={s} focus={focusId === s.id} onState={onState} onRemoved={removed} />
            ))}
          </div>
          <div className={css.addRow}>
            <button ref={addRef} type="button" className={cn(styles.addButton, css.addReset)} onClick={add} disabled={adding}>
              {adding ? "Adding…" : "+ Add a section"}
            </button>
          </div>
          <p className={cn(css.saved, pageState.kind === "error" ? css.savedError : "", "chalk-soft")} role="status">
            {note ?? saveText(pageState)}
          </p>
        </>
      )}
    </div>
  );
}

function SectionCard({
  section,
  focus,
  onState,
  onRemoved,
}: {
  section: BringSection;
  focus: boolean;
  onState: (id: string, state: SaveState) => void;
  onRemoved: (id: string) => void;
}) {
  const [name, setName] = useState(section.name);
  const [items, setItems] = useState(section.items.join("\n"));
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const itemsRef = useAutoHeight(items);
  const twoTap = useTwoTap();
  const save = useCallback(async (value: { name: string; items: string }) => {
    await shootsApi.saveSection(section.id, value);
  }, [section.id]);
  const autosave = useAutosave(save);

  useEffect(() => {
    onState(section.id, autosave.state);
  }, [autosave.state, onState, section.id]);

  useEffect(() => {
    if (focus) nameRef.current?.focus();
  }, [focus]);

  const change = (next: { name?: string; items?: string }) => {
    const value = { name: next.name ?? name, items: next.items ?? items };
    if (next.name !== undefined) setName(next.name);
    if (next.items !== undefined) setItems(next.items);
    autosave.queue(value);
  };

  const remove = () =>
    twoTap.tap(async () => {
      autosave.cancel();
      setRemoving(true);
      setRemoveError(null);
      try {
        await shootsApi.removeSection(section.id);
        onRemoved(section.id);
      } catch (err) {
        setRemoveError((err as Error).message);
        setRemoving(false);
        twoTap.reset();
      }
    });
  const confirming = twoTap.confirming;

  const rows = Math.max(3, items.split("\n").length + 1);

  const label = name.trim() || "untitled section";

  return (
    <section className={css.card} aria-label={name.trim() || "New section"}>
      <div className={css.field}>
        <label className={cn(styles.label, "chalk-soft")} htmlFor={`sn-${section.id}`}>Section name</label>
        <input
          ref={nameRef}
          id={`sn-${section.id}`}
          className={styles.input}
          value={name}
          maxLength={80}
          placeholder="e.g. Christmas props"
          onChange={(e) => change({ name: e.target.value })}
          onBlur={() => void autosave.flush()}
        />
      </div>
      <div className={css.field}>
        <label className={cn(styles.label, "chalk-soft")} htmlFor={`si-${section.id}`}>What to bring</label>
        <textarea
          ref={itemsRef}
          id={`si-${section.id}`}
          className={cn(styles.input, css.items)}
          rows={rows}
          value={items}
          aria-describedby={`sh-${section.id}`}
          onChange={(e) => change({ items: e.target.value })}
          onBlur={() => void autosave.flush()}
        />
        <p id={`sh-${section.id}`} className={cn(styles.hintSmall, "chalk-soft")}>One per line.</p>
      </div>
      <div className={css.sectionFoot}>
        <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={remove} disabled={removing}>
          {removing ? "Removing…" : confirming ? "Tap again to remove" : "Remove this section"}
          <span className={styles.visuallyHidden}> ({label})</span>
        </button>
      </div>
      {removeError && <p className={cn(styles.error, "chalk-soft")} role="alert">{removeError}</p>}
    </section>
  );
}
