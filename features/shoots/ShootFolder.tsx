"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "@/features/admin/Admin.module.css";
import { cn } from "@/lib/cn";
import { shootsApi, ShootsApiError } from "@/lib/shoots/client";
import { clock, shortDay } from "@/lib/shoots/format";
import { groupTitle, MAX_SECTIONS_PER_GROUP, newSectionName, sectionBlocks } from "@/lib/shoots/sections";
import type { InspoGroup, InspoItem, ShootDetail, ShootSection } from "@/lib/shoots/types";
import InspoDrop, { type MoveTarget } from "./InspoDrop";
import { peopleOf, picksWho } from "@/lib/shoots/people";
import NotReady from "./NotReady";
import { saveText, useAutosave } from "./useAutosave";
import { useAutoHeight } from "./useAutoHeight";
import { useTwoTap } from "./useTwoTap";
import css from "./Shoots.module.css";

/** /admin/shoots/folder/[id]: one shoot's folder (the family's info, inspo, BTS ideas and notes). */
export default function ShootFolder({ shootKey }: { shootKey: string }) {
  const [shoot, setShoot] = useState<ShootDetail | null>(null);
  const [error, setError] = useState<ShootsApiError | null>(null);

  useEffect(() => {
    shootsApi
      .shoot(shootKey)
      .then(setShoot)
      .catch((e: ShootsApiError) => setError(e));
  }, [shootKey]);

  const [fresh, setFresh] = useState<string | null>(null);
  const added = useCallback((item: InspoItem) => setShoot((s) => (s ? { ...s, inspo: [...s.inspo, item] } : s)), []);
  const removed = useCallback((id: string) => setShoot((s) => (s ? { ...s, inspo: s.inspo.filter((i) => i.id !== id) } : s)), []);
  const moved = useCallback((item: InspoItem) => setShoot((s) => (s ? { ...s, inspo: s.inspo.map((i) => (i.id === item.id ? item : i)) } : s)), []);
  const sectionAdded = useCallback((section: ShootSection) => {
    setFresh(section.id);
    setShoot((s) => (s ? { ...s, sections: [...s.sections, section] } : s));
  }, []);
  const sectionRenamed = useCallback((section: ShootSection) => setShoot((s) => (s ? { ...s, sections: s.sections.map((x) => (x.id === section.id ? section : x)) } : s)), []);
  // its shots go back to the main section, as on the server
  const sectionRemoved = useCallback(
    (id: string) => setShoot((s) => (s ? { ...s, sections: s.sections.filter((x) => x.id !== id), inspo: s.inspo.map((i) => (i.sectionId === id ? { ...i, sectionId: null } : i)) } : s)),
    [],
  );

  if (error?.notReady) {
    return (
      <>
        <h1 className={cn(styles.h1, "chalk")}>Shoot folder</h1>
        <NotReady />
      </>
    );
  }
  if (error) {
    return (
      <>
        <p className={cn(css.crumbs, "chalk-soft")}><Link href="/admin/shoots">← All shoots</Link></p>
        <h1 className={cn(styles.h1, "chalk")}>{error.status === 404 ? "Not found" : "Couldn't open this folder"}</h1>
        <p className={cn(styles.muted, "chalk-soft")} role="alert">{error.status === 404 ? "That shoot isn't here anymore." : error.message}</p>
      </>
    );
  }
  if (!shoot) return <p className={cn(styles.hintSmall, "chalk-soft")} role="status">Opening the folder…</p>;

  const styled = shoot.kind === "styled";
  const b = shoot.booking;
  const day = shortDay(shoot.date);
  const [bundleName, ...bundleRest] = (shoot.bundleLine ?? "").split(" · ");
  const people = peopleOf(b);

  return (
    <div>
      <p className={cn(css.crumbs, "chalk-soft")}>
        <Link href="/admin/shoots">← All shoots</Link> · <Link href={`/admin/shoots/${shoot.date}`}>{day} day sheet</Link>
      </p>
      <header className={css.folderHead}>
        <p className={cn(css.kicker, "chalk-soft")}>
          {styled ? "Shoot without a booking" : "Shoot folder"} · {day} · {clock(shoot.start)}
          {shoot.end ? ` to ${clock(shoot.end)}` : ""}
        </p>
        <h1 className={cn(styles.h1, "chalk")}>{shoot.title}</h1>
        {b?.status === "cancelled" && <p className={cn(styles.bannerError, "chalk-soft")}>This booking was cancelled, so it&apos;s not on any day sheet.</p>}
        <ul className={css.facts} aria-label="About this shoot">
          {b && (
            <li>
              <b>{bundleName}</b> · {bundleRest.join(" · ")}
            </li>
          )}
          {people.map((p) => (
            <li key={p.key}>
              <b>{p.label}</b>
              {p.detail ? ` · ${p.detail}` : ""}
            </li>
          ))}
          {b?.people && <li>{b.people}</li>}
          {b?.backdrops.map((x) => (
            <li key={x.id}>
              <i className={css.swatch} style={{ background: x.color }} aria-hidden="true" />
              {x.name}
            </li>
          ))}
          {b?.addons.map((a) => (
            <li key={a.name}>
              {a.name}
              {a.quantity > 1 ? ` ×${a.quantity}` : ""}
            </li>
          ))}
          {shoot.place && <li>{shoot.place}</li>}
          {b && <li>{b.reference}</li>}
          {b?.status === "pending" && <li className={css.factWarn}>Waiting on the deposit</li>}
        </ul>
        {b?.pick && (
          <p className={css.pick}>
            <a href={b.pick.src} target="_blank" rel="noopener noreferrer" className={css.pickThumb}>
              <Image src={b.pick.src} alt={`Their pick when booking: ${b.pick.title}`} fill sizes="56px" />
            </a>
            <span className={cn(styles.hintSmall, "chalk-soft")}>Their pick when booking</span>
          </p>
        )}
        <p className={css.folderActions}>
          <Link href={`/admin/shoots/${shoot.date}`} className={styles.smallButton}>
            Open the day sheet →
          </Link>
        </p>
      </header>

      <div className={css.folderGrid}>
        <div>
          <section aria-labelledby="inspo-title">
            <h2 id="inspo-title" className={cn(styles.h2, "chalk")}>{shoot.inspoTitle}</h2>
            <p className={cn(styles.hintSmall, css.sectionLead, "chalk-soft")}>
              What the family sends you, plus your own ideas. Say what each shot is{picksWho(people) ? " and who's in it: the day sheet groups them that way" : ""}.
            </p>
            <GroupSections shoot={shoot} group="inspo" people={people} fresh={fresh} onAdd={added} onRemove={removed} onMoved={moved} onSectionAdded={sectionAdded} onSectionRenamed={sectionRenamed} onSectionRemoved={sectionRemoved} />
          </section>
          <section className={css.block} aria-labelledby="bts-title">
            <h2 id="bts-title" className={cn(styles.h2, "chalk")}>BTS on phones</h2>
            <p className={cn(styles.hintSmall, css.sectionLead, "chalk-soft")}>Your own ideas for clips and phone photos for Instagram.</p>
            <GroupSections shoot={shoot} group="bts" people={[]} fresh={fresh} onAdd={added} onRemove={removed} onMoved={moved} onSectionAdded={sectionAdded} onSectionRenamed={sectionRenamed} onSectionRemoved={sectionRemoved} />
          </section>
        </div>
        <aside className={css.colSide} aria-label="Notes">
          <Notes shoot={shoot} />
        </aside>
      </div>
    </div>
  );
}

/**
 * One group (Inspo or BTS): its main list, then the owner's own sections (owner, Nov 12: "Inspo for David · Section 2",
 * another outfit or a Reel), each with its own drop area, then "+ Add a section". Every card can "Move to" another one.
 */
function GroupSections({
  shoot,
  group,
  people,
  fresh,
  onAdd,
  onRemove,
  onMoved,
  onSectionAdded,
  onSectionRenamed,
  onSectionRemoved,
}: {
  shoot: ShootDetail;
  group: InspoGroup;
  people: ReturnType<typeof peopleOf>;
  fresh: string | null;
  onAdd: (item: InspoItem) => void;
  onRemove: (id: string) => void;
  onMoved: (item: InspoItem) => void;
  onSectionAdded: (section: ShootSection) => void;
  onSectionRenamed: (section: ShootSection) => void;
  onSectionRemoved: (id: string) => void;
}) {
  const blocks = sectionBlocks(group, shoot.inspo, shoot.sections, shoot.inspoTitle);
  const targets: MoveTarget[] = blocks.map((b) => ({ id: b.id, name: b.title }));
  const [main, ...own] = blocks;
  const shared = { shootKey: shoot.key, group, onAdd, onRemove, people, moveTo: targets, onMoved };
  return (
    <>
      <InspoDrop {...shared} items={main.items} />
      {own.map((b) => (
        <OwnSection key={b.id} section={shoot.sections.find((x) => x.id === b.id)!} count={b.items.length} mainTitle={main.title} shootKey={shoot.key} startEditing={fresh === b.id} onRenamed={onSectionRenamed} onRemoved={onSectionRemoved}>
          <InspoDrop {...shared} items={b.items} sectionId={b.id} compact />
        </OwnSection>
      ))}
      <AddSection shootKey={shoot.key} group={group} full={own.length >= MAX_SECTIONS_PER_GROUP} name={newSectionName(group, shoot.sections, shoot.inspoTitle)} title={groupTitle(group, shoot.inspoTitle)} onAdded={onSectionAdded} />
    </>
  );
}

/** One of the owner's sections: its name (Rename), Remove section (two taps; its shots go back to the main one). */
function OwnSection({
  section,
  count,
  mainTitle,
  shootKey,
  startEditing,
  onRenamed,
  onRemoved,
  children,
}: {
  section: ShootSection;
  count: number;
  mainTitle: string;
  shootKey: string;
  startEditing: boolean;
  onRenamed: (section: ShootSection) => void;
  onRemoved: (id: string) => void;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [name, setName] = useState(section.name);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const twoTap = useTwoTap();
  const titleId = `section-${section.id}`;
  const inputId = `section-name-${section.id}`;

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = name.trim();
    if (!next) {
      setError("Give the section a name.");
      inputRef.current?.focus();
      return;
    }
    setBusy("save");
    setError(null);
    try {
      onRenamed(await shootsApi.renameShotSection(shootKey, section.id, next));
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = () =>
    twoTap.tap(async () => {
      setBusy("remove");
      setError(null);
      try {
        await shootsApi.deleteShotSection(shootKey, section.id);
        onRemoved(section.id);
      } catch (err) {
        setError((err as Error).message);
        setBusy(null);
        twoTap.reset();
      }
    });

  return (
    <section className={css.ownSection} aria-labelledby={titleId}>
      <h3 id={titleId} className={css.ownTitle}>{section.name}</h3>
      {editing ? (
        <form className={css.renameRow} onSubmit={save} noValidate>
          <label className={cn(styles.label, "chalk-soft")} htmlFor={inputId}>Section name</label>
          <div className={css.linkRow}>
            <input ref={inputRef} id={inputId} className={styles.input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className={styles.smallButton} disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save"}</button>
          </div>
          <button
            type="button"
            className={cn(styles.linkButton, "chalk-soft")}
            onClick={() => {
              setName(section.name);
              setEditing(false);
              setError(null);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <p className={css.ownActions}>
          <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => setEditing(true)}>
            Rename<span className={styles.visuallyHidden}> {section.name}</span>
          </button>
          <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={remove} disabled={busy !== null}>
            {busy === "remove"
              ? "Removing…"
              : twoTap.confirming
                ? count
                  ? `Tap again: its ${count === 1 ? "1 item moves" : `${count} items move`} to ${mainTitle}`
                  : "Tap again to remove it"
                : "Remove section"}
            <span className={styles.visuallyHidden}> ({section.name})</span>
          </button>
        </p>
      )}
      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
      {children}
    </section>
  );
}

/** "+ Add a section": starts as "Inspo for David · Section 2" and opens its name to change it. */
function AddSection({ shootKey, group, name, title, full, onAdded }: { shootKey: string; group: InspoGroup; name: string; title: string; full: boolean; onAdded: (section: ShootSection) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (full) return <p className={cn(styles.hintSmall, css.addSectionRow, "chalk-soft")}>That&apos;s the most sections here ({MAX_SECTIONS_PER_GROUP}).</p>;
  return (
    <div className={css.addSectionRow}>
      <button
        type="button"
        className={styles.smallButton}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            onAdded(await shootsApi.addShotSection(shootKey, group, name));
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Adding…" : "+ Add a section"}
        <span className={styles.visuallyHidden}> to {title}</span>
      </button>
      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
    </div>
  );
}

type Field = "said" | "confirm" | "bringExtra";

/** Notes: what they asked for, still to confirm, bring extra. Only the fields that changed are sent. */
function Notes({ shoot }: { shoot: ShootDetail }) {
  const router = useRouter();
  const styled = shoot.kind === "styled";
  const [said, setSaid] = useState(shoot.said);
  const [confirm, setConfirm] = useState(shoot.confirm.join("\n"));
  const [extra, setExtra] = useState(shoot.bringExtra.join("\n"));
  const values = useRef<Record<Field, string>>({ said: shoot.said, confirm: shoot.confirm.join("\n"), bringExtra: shoot.bringExtra.join("\n") });
  const dirty = useRef(new Set<Field>());
  const saidRef = useAutoHeight(said);
  const confirmRef = useAutoHeight(confirm);
  const extraRef = useAutoHeight(extra);
  const twoTap = useTwoTap();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const save = useCallback(async () => {
    const fields = [...dirty.current];
    if (!fields.length) return;
    dirty.current.clear();
    try {
      await shootsApi.saveShoot(shoot.key, Object.fromEntries(fields.map((f) => [f, values.current[f]])));
    } catch (err) {
      fields.forEach((f) => dirty.current.add(f));
      throw err;
    }
  }, [shoot.key]);
  const autosave = useAutosave(save);

  const change = (field: Field, value: string, set: (v: string) => void) => {
    set(value);
    values.current[field] = value;
    dirty.current.add(field);
    autosave.queue(null);
  };

  const remove = () =>
    twoTap.tap(async () => {
      autosave.cancel();
      setDeleting(true);
      setDeleteError(null);
      try {
        await shootsApi.deleteShoot(shoot.key);
        router.push("/admin/shoots");
      } catch (err) {
        setDeleteError((err as Error).message);
        setDeleting(false);
        twoTap.reset();
      }
    });

  return (
    <section className={css.card} aria-labelledby="notes-title">
      <h2 id="notes-title" className={css.cardTitle}>Notes</h2>
      <div className={css.field}>
        <label className={cn(styles.label, "chalk-soft")} htmlFor="f-said">{styled ? "The idea" : "What the family asked for"}</label>
        <textarea ref={saidRef} id="f-said" className={cn(styles.input, css.items)} rows={3} value={said} maxLength={4000} aria-describedby={styled ? undefined : "h-said"} onChange={(e) => change("said", e.target.value, setSaid)} onBlur={() => void autosave.flush()} />
        {!styled && <p id="h-said" className={cn(styles.hintSmall, "chalk-soft")}>Starts with their booking notes. Add what they tell you later.</p>}
      </div>
      <div className={css.field}>
        <label className={cn(styles.label, "chalk-soft")} htmlFor="f-confirm">Still to confirm</label>
        <textarea ref={confirmRef} id="f-confirm" className={cn(styles.input, css.items)} rows={2} value={confirm} aria-describedby="h-confirm" onChange={(e) => change("confirm", e.target.value, setConfirm)} onBlur={() => void autosave.flush()} />
        <p id="h-confirm" className={cn(styles.hintSmall, "chalk-soft")}>One per line. Questions to ask when you get there.</p>
      </div>
      <div className={css.field}>
        <label className={cn(styles.label, "chalk-soft")} htmlFor="f-extra">Bring extra</label>
        <textarea ref={extraRef} id="f-extra" className={cn(styles.input, css.items)} rows={2} value={extra} placeholder="Only what isn't on your standard list" aria-describedby="h-extra" onChange={(e) => change("bringExtra", e.target.value, setExtra)} onBlur={() => void autosave.flush()} />
        <p id="h-extra" className={cn(styles.hintSmall, "chalk-soft")}>One per line. Their backdrops and booked add-ons are added for you.</p>
      </div>
      <p className={cn(css.saved, autosave.state.kind === "error" ? css.savedError : "", "chalk-soft")} role="status">
        {saveText(autosave.state)}
      </p>
      {styled && (
        <div className={css.sectionFoot}>
          <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={remove} disabled={deleting}>
            {deleting ? "Deleting…" : twoTap.confirming ? "Tap again to delete this shoot" : "Delete this shoot"}
          </button>
          {deleteError && <p className={cn(styles.error, "chalk-soft")} role="alert">{deleteError}</p>}
        </div>
      )}
    </section>
  );
}
