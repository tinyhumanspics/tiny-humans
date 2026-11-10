"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "@/features/admin/Admin.module.css";
import { cn } from "@/lib/cn";
import { shootsApi, ShootsApiError } from "@/lib/shoots/client";
import { clock, shortDay } from "@/lib/shoots/format";
import type { InspoItem, ShootDetail } from "@/lib/shoots/types";
import InspoDrop from "./InspoDrop";
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

  const added = useCallback((item: InspoItem) => setShoot((s) => (s ? { ...s, inspo: [...s.inspo, item] } : s)), []);
  const removed = useCallback((id: string) => setShoot((s) => (s ? { ...s, inspo: s.inspo.filter((i) => i.id !== id) } : s)), []);

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
          {b?.babies.map((x, i) => (
            <li key={i}>
              <b>{x.name || (b.babies.length > 1 ? `Baby ${i + 1}` : "Baby")}</b> · {x.age}
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
            <p className={cn(styles.hintSmall, css.sectionLead, "chalk-soft")}>What the family sends you, plus your own ideas. Say what each shot is.</p>
            <InspoDrop shootKey={shoot.key} group="inspo" items={shoot.inspo.filter((i) => i.group === "inspo")} onAdd={added} onRemove={removed} />
          </section>
          <section className={css.block} aria-labelledby="bts-title">
            <h2 id="bts-title" className={cn(styles.h2, "chalk")}>BTS on phones</h2>
            <p className={cn(styles.hintSmall, css.sectionLead, "chalk-soft")}>Your own ideas for clips and phone photos for Instagram.</p>
            <InspoDrop shootKey={shoot.key} group="bts" items={shoot.inspo.filter((i) => i.group === "bts")} onAdd={added} onRemove={removed} />
          </section>
        </div>
        <aside className={css.colSide} aria-label="Notes">
          <Notes shoot={shoot} />
        </aside>
      </div>
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
