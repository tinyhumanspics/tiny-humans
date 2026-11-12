"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/features/admin/Admin.module.css";
import { cn } from "@/lib/cn";
import { clock, dayParts, plural } from "@/lib/shoots/format";
import { inspoKey, progressOf } from "@/lib/shoots/ticks";
import type { BringLine, InspoItem, ShootDetail } from "@/lib/shoots/types";
import { InspoTile } from "./InspoDrop";
import { byKind, inShownOrder, KIND_LABEL } from "@/lib/shoots/kinds";
import { groupByWho, peopleOf, picksWho } from "@/lib/shoots/people";
import { sectionBlocks } from "@/lib/shoots/sections";
import InspoLightbox, { type LightboxPhoto, viewerItems } from "./InspoLightbox";
import NotReady from "./NotReady";
import { useDayTicks } from "./useDayTicks";
import { useTwoTap } from "./useTwoTap";
import css from "./Shoots.module.css";

const sectionId = (key: string) => `s-${key.replace(/[^A-Za-z0-9_-]/g, "")}`;

/**
 * /admin/shoots/[date]: the sheet for a shoot day, phone first (template: "Shoot day sheet"). Who's on camera,
 * Still to confirm, each family (address, backdrops, what they asked for, inspo + BTS to tick), then What to bring.
 * Ticks show on both phones (useDayTicks).
 */
export default function DaySheet({ date }: { date: string }) {
  const { day, error, isTicked, toggle, clearAll, retrying } = useDayTicks(date);
  const [viewing, setViewing] = useState<{ photos: LightboxPhoto[]; index: number; tick: boolean } | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const chipsRef = useRef<HTMLElement>(null);
  const p = dayParts(date);

  const keys = useMemo(() => {
    if (!day) return [];
    const b = day.bring;
    return [
      ...day.shoots.flatMap((s) => s.inspo.map((i) => inspoKey(i.id))),
      ...b.backdrops.map((x) => x.key),
      ...b.extras.map((x) => x.key),
      ...b.sections.flatMap((s) => s.items.map((x) => x.key)),
    ];
  }, [day]);

  // the chip of the section on screen lights up (and scrolls into view in the chip bar)
  useEffect(() => {
    if (!day) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setCurrent(e.target.id)),
      { rootMargin: "-90px 0px -65% 0px" },
    );
    document.querySelectorAll("[data-tabsec]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [day]);

  useEffect(() => {
    const chip = chipsRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    const bar = chipsRef.current;
    if (chip && bar) bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.offsetWidth / 2, behavior: "smooth" });
  }, [current]);

  const heading = (
    <h1 className={css.bigDate}>
      {p.weekday}, <span className={css.dayDate}>{p.month} {p.day}</span>
    </h1>
  );

  if (error?.notReady) {
    return (
      <>
        {heading}
        <NotReady />
      </>
    );
  }
  if (error && !day) {
    return (
      <>
        <p className={cn(css.crumbs, "chalk-soft")}><Link href="/admin/shoots">← All shoots</Link></p>
        {heading}
        <p className={cn(styles.error, "chalk-soft")} role="alert">{error.message}</p>
      </>
    );
  }
  if (!day) return <p className={cn(styles.hintSmall, "chalk-soft")} role="status">Opening the day sheet…</p>;

  const progress = progressOf(keys, keys.filter(isTicked));
  const pct = progress.total ? Math.round((progress.ticked / progress.total) * 100) : 0;
  const places = [...new Set(day.shoots.map((s) => s.place).filter((x): x is string => Boolean(x)))];
  const nInspo = day.shoots.reduce((n, s) => n + s.inspoCount, 0);
  const nBts = day.shoots.reduce((n, s) => n + s.btsCount, 0);
  const confirms = day.shoots.flatMap((s) => [...s.autoConfirm, ...s.confirm].map((text) => ({ who: s.tabLabel, text })));
  const jump = (id: string) => {
    setCurrent(id);
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <div className={css.sheet}>
      <p className={cn(css.crumbs, "chalk-soft")}><Link href="/admin/shoots">← All shoots</Link></p>
      <header className={css.sheetHead}>
        <p className={cn(css.eyebrow, "chalk-soft")}>Tiny Humans · Shoot day sheet</p>
        {heading}
        <p className={cn(css.sum, "chalk-soft")}>
          {plural(day.shoots.length, "shoot", "shoots")}
          {places.length ? ` · ${places.join(", ")}` : ""}
        </p>
        <p className={cn(css.stats, "chalk-soft")}>
          <b>{nInspo}</b> inspo · <b>{nBts}</b> BTS ideas{day.sunset && <> · sunset <b>{clock(day.sunset)}</b></>}
        </p>
        <p className={cn(css.stats, "chalk-soft")}>
          <b>{progress.ticked}</b> of <b>{progress.total}</b> ticked
        </p>
        <div className={css.bar} aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className={cn(css.saved, css.savedError, "chalk-soft")} role="status">{retrying ? "Not saved yet, retrying…" : ""}</p>
      </header>

      {day.shoots.length === 0 ? (
        <p className={cn(styles.muted, "chalk-soft")}>No shoots on this day.</p>
      ) : (
        <>
          <nav ref={chipsRef} className={css.chips} aria-label="Jump to">
            {day.shoots.map((s) => (
              <button key={s.key} type="button" className={css.chip} aria-current={current === sectionId(s.key) ? "true" : undefined} onClick={() => jump(sectionId(s.key))}>
                {s.tabLabel}
              </button>
            ))}
            <button type="button" className={css.chip} aria-current={current === "sec-bring" ? "true" : undefined} onClick={() => jump("sec-bring")}>
              What to bring
            </button>
          </nav>

          <section className={cn(css.card, css.sheetCard)} aria-labelledby="who-title">
            <h2 id="who-title" className={css.cardTitle}>Who&apos;s on camera</h2>
            <ul className={css.whoList}>
              {day.shoots.map((s) => (
                <li key={s.key} className="chalk-soft">
                  <b>{s.tabLabel}:</b> {s.whoLine}. {clock(s.start)}
                  {s.place ? `, ${s.place}` : ""}.
                </li>
              ))}
            </ul>
          </section>

          {confirms.length > 0 && (
            <section className={cn(css.card, css.sheetCard, css.confirmCard)} aria-labelledby="confirm-title">
              <h2 id="confirm-title" className={cn(css.cardTitle, css.confirmTitle)}>Still to confirm</h2>
              <ul className={css.confirmList}>
                {confirms.map((c, i) => (
                  <li key={i} className="chalk-soft">
                    <b>{c.who}:</b> {c.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {day.shoots.map((s, i) => (
            <ShootBlock key={s.key} shoot={s} n={i + 1} isTicked={isTicked} toggle={toggle} onView={(photos, index, tick) => setViewing({ photos, index, tick })} />
          ))}

          <section id="sec-bring" data-tabsec className={css.sheetBlock} aria-labelledby="bring-title">
            <h2 id="bring-title" className={cn(styles.h2, "chalk")}>What to bring</h2>
            <p className={cn(styles.hintSmall, "chalk-soft")}>
              Backdrops and extras come from today&apos;s bookings and folders. The rest is your standard list (<Link href="/admin/shoots/bring">change it here</Link>).
            </p>
            <BringList title="Backdrops (from the bookings)" lines={day.bring.backdrops} isTicked={isTicked} toggle={toggle} swatches />
            {day.bring.extras.length > 0 && <BringList title="Extras for these shoots" lines={day.bring.extras} isTicked={isTicked} toggle={toggle} />}
            {day.bring.sections.map((sec) => (
              <BringList key={sec.id} title={sec.name} lines={sec.items} isTicked={isTicked} toggle={toggle} />
            ))}
            <ClearTicks onClear={clearAll} />
          </section>
        </>
      )}

      {viewing && (
        <InspoLightbox
          photos={viewing.photos}
          index={viewing.index}
          onIndex={(index) => setViewing((v) => (v ? { ...v, index } : v))}
          onClose={() => setViewing(null)}
          done={viewing.tick ? { isDone: (id) => isTicked(inspoKey(id)), toggle: (id) => toggle(inspoKey(id)) } : undefined}
        />
      )}
    </div>
  );
}

function ShootBlock({
  shoot: s,
  n,
  isTicked,
  toggle,
  onView,
}: {
  shoot: ShootDetail;
  n: number;
  isTicked: (key: string) => boolean;
  toggle: (key: string) => void;
  onView: (photos: LightboxPhoto[], index: number, tick: boolean) => void;
}) {
  const b = s.booking;
  const mapUrl = b?.mapUrl ?? (s.place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.place)}` : null);
  // twins and family shoots: everyone listed, and the shots in sections by who's in them
  const people = peopleOf(b);
  const sectionsFor = (items: InspoItem[]) => (picksWho(people) && items.some((i) => i.who.length) ? groupByWho(items, people) : null);
  // photos, then videos, then ideas and links, each on their own rows (owner, Nov 12: never mixed)
  const shotCards = (items: InspoItem[], photos: LightboxPhoto[]) => {
    const kinds = byKind(items);
    return kinds.map((k) => (
      <div key={k.kind}>
        {kinds.length > 1 && <p className={cn(css.kindH, "chalk-soft")}>{KIND_LABEL[k.kind]}</p>}
        {shotGrid(k.items, photos)}
      </div>
    ));
  };
  const shotGrid = (items: InspoItem[], photos: LightboxPhoto[]) => (
    <ul className={css.shotGrid}>
      {items.map((item) => {
        const key = inspoKey(item.id);
        const done = isTicked(key);
        return (
          <li key={item.id} className={cn(css.shotCard, done ? css.shotDone : "")}>
            <InspoTile item={item} linkHint="Open the link" onOpen={() => onView(photos, Math.max(0, photos.findIndex((x) => x.id === item.id)), true)} />
            <button type="button" className={css.phTick} aria-pressed={done} onClick={() => toggle(key)}>
              <span className={styles.visuallyHidden}>Done: {item.caption || "this one"}</span>
            </button>
            <p className={cn(css.cap, "chalk-soft")}>{item.caption || "No description yet"}</p>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section id={sectionId(s.key)} data-tabsec className={css.session} aria-labelledby={`${sectionId(s.key)}-t`}>
      <p className={cn(css.kicker, "chalk-soft")}>
        {s.kind === "styled" ? "No booking" : `Shoot ${n}`} · {clock(s.start)}
        {s.end ? ` to ${clock(s.end)}` : ""}
      </p>
      <h2 id={`${sectionId(s.key)}-t`} className={css.sessName}>{s.title}</h2>
      <p className={cn(css.addr, "chalk-soft")}>
        {b?.address ?? s.place ?? ""}
        {mapUrl && (
          <>
            {" · "}
            <a href={mapUrl} target="_blank" rel="noopener noreferrer">Map<span className={styles.visuallyHidden}> (opens Maps)</span></a>
          </>
        )}
        {s.bundleName ? ` · ${s.bundleName}` : ""}
        {b ? ` · ${b.reference}` : ""}
      </p>
      {b && b.backdrops.length > 0 && (
        <p className={css.swatches} aria-label="Backdrops they picked">
          {b.backdrops.map((x) => (
            <span key={x.id} className={cn(css.sw, "chalk-soft")}>
              <i style={{ background: x.color }} aria-hidden="true" />
              {x.name}
            </span>
          ))}
        </p>
      )}
      {picksWho(people) && (
        <ul className={css.people} aria-label="Who's in the photos">
          {people.map((p) => (
            <li key={p.key}>
              <b>{p.label}</b>
              {p.detail ? ` · ${p.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
      {(s.said || b?.pick) && (
        <div className={css.note}>
          <h3 className={cn(css.noteH, "chalk-soft")}>{s.kind === "styled" ? "The idea" : "What the family asked for"}</h3>
          {s.said && <p className="chalk-soft">{s.said}</p>}
          {b?.pick && (
            <p className={css.pick}>
              <button type="button" className={css.pickButton} onClick={() => onView([{ id: b.pick!.id, src: b.pick!.src, caption: `Their pick: ${b.pick!.title}` }], 0, false)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a small site photo shown as a thumbnail */}
                <img src={b.pick.src} alt="" />
                <span className={styles.visuallyHidden}>See their pick big</span>
              </button>
              <span className={cn(styles.hintSmall, "chalk-soft")}>Their pick when booking</span>
            </p>
          )}
        </div>
      )}

      {(["inspo", "bts"] as const).map((g) => {
        // the group's main list, then the owner's own sections (owner, Nov 12), each with its own count
        const blocks = sectionBlocks(g, s.inspo, s.sections, s.inspoTitle);
        const whoSections = (items: InspoItem[]) => (g === "inspo" ? sectionsFor(items) : null);
        // photos and videos open in the order they're shown: block by block, by who's in them, photos before videos
        const ordered = blocks.flatMap((b) => {
          const who = whoSections(b.items);
          return who ? who.flatMap((x) => inShownOrder(x.items)) : inShownOrder(b.items);
        });
        const photos = viewerItems(ordered);
        const own = blocks.length > 1;
        const shown = blocks.filter((b, n) => n > 0 || b.items.length > 0 || !own);
        return (
          <div key={g}>
            {shown.map((b, n) => {
              const keys = b.items.map((i) => inspoKey(i.id));
              const c = progressOf(keys, keys.filter(isTicked));
              const who = whoSections(b.items);
              return (
                <div key={b.id ?? "main"}>
                  <h3 className={css.orderH}>
                    {b.title} <span className={cn(css.orderCount, "chalk-soft")}>{c.ticked}/{c.total}</span>
                  </h3>
                  {b.items.length ? (
                    <>
                      {g === "inspo" && n === 0 && <p className={cn(css.help, "chalk-soft")}>Tap a photo to see it big, or a video to play it here. Tap its check once you have the shot.</p>}
                      {who
                        ? who.map((x) => {
                            const done = x.items.filter((i) => isTicked(inspoKey(i.id))).length;
                            return (
                              <div key={x.key || "none"} className={css.whoSection}>
                                <h4 className={css.whoH}>
                                  {x.label} <span className={cn(css.orderCount, "chalk-soft")}>{done}/{x.items.length}</span>
                                </h4>
                                {x.detail && <p className={cn(css.whoDetail, "chalk-soft")}>{x.detail}</p>}
                                {shotCards(x.items, photos)}
                              </div>
                            );
                          })
                        : shotCards(b.items, photos)}
                    </>
                  ) : b.id ? (
                    <p className={cn(styles.hintSmall, "chalk-soft")}>Nothing in this section yet.</p>
                  ) : g === "inspo" ? (
                    <p className={cn(css.empty, "chalk-soft")}>
                      No inspo yet. <Link href={`/admin/shoots/folder/${s.key}`}>Open the folder</Link> to drop in what the family sends.
                    </p>
                  ) : (
                    <p className={cn(styles.hintSmall, "chalk-soft")}>No BTS ideas for this shoot yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <p className={css.folderLink}>
        <Link href={`/admin/shoots/folder/${s.key}`}>Open the {s.tabLabel} folder →</Link>
      </p>
    </section>
  );
}

function BringList({ title, lines, isTicked, toggle, swatches = false }: { title: string; lines: BringLine[]; isTicked: (k: string) => boolean; toggle: (k: string) => void; swatches?: boolean }) {
  return (
    <>
      <h3 className={cn(css.lbl, "chalk-soft")}>{title}</h3>
      {lines.length === 0 ? (
        <p className={cn(styles.hintSmall, "chalk-soft")}>Nothing yet.</p>
      ) : (
        <ul className={css.checklist}>
          {lines.map((l) => {
            const done = isTicked(l.key);
            return (
              <li key={l.key} className={done ? css.checkDone : undefined}>
                <label>
                  <input type="checkbox" className={css.tick} checked={done} onChange={() => toggle(l.key)} />
                  <span>
                    {swatches && l.color && <i className={css.swatch} style={{ background: l.color }} aria-hidden="true" />}
                    {l.text}
                    {l.who ? <span className={css.who}> ({l.who})</span> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** "Clear all ticks": two taps, no browser confirm box. */
function ClearTicks({ onClear }: { onClear: () => Promise<void> }) {
  const twoTap = useTwoTap();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className={css.clearRow}>
      <button
        type="button"
        className={cn(styles.smallButton, styles.danger)}
        disabled={busy}
        onClick={() =>
          twoTap.tap(async () => {
            setBusy(true);
            setErr(null);
            try {
              await onClear();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
              twoTap.reset();
            }
          })
        }
      >
        {busy ? "Clearing…" : twoTap.confirming ? "Tap again to clear every tick" : "Clear all ticks"}
      </button>
      {err && <p className={cn(styles.error, "chalk-soft")} role="alert">{err}</p>}
    </div>
  );
}
