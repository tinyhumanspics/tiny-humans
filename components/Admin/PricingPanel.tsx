"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Bundle } from "@/config/bundles";
import type { AdminApi } from "@/lib/admin/client";
import { activeOffer, formatMoney, toCents } from "@/lib/pricing/engine";
import type { DiscountCode } from "@/lib/pricing/types";
import type { BundleInput, CodeInput } from "@/lib/pricing/validation";
import { formatLongDate } from "@/lib/booking/dates";
import { todayInZone } from "@/lib/booking/timezone";
import { bookingRules } from "@/config/booking";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import styles from "./Admin.module.css";

type Note = { kind: "ok" | "error"; text: string } | null;
const errText = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
const shortDate = (d: string) => formatLongDate(d).replace(/^\w+, /, "");

/** Owner area: bundles (names, prices, inclusions, offers) and discount codes. */
export default function PricingPanel({ api }: { api: AdminApi }) {
  const [bundles, setBundles] = useState<Bundle[] | null>(null);
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [dbReady, setDbReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Bundle | "new" | null>(null);
  const [editingCode, setEditingCode] = useState<DiscountCode | "new" | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [confirm, setConfirm] = useState<{ title: string; text: string; action: () => Promise<void> } | null>(null);
  const today = todayInZone(bookingRules.timeZone);

  useEffect(() => {
    api.getPricing().then((p) => { setBundles(p.bundles); setCodes(p.codes); setDbReady(p.databaseConfigured); }).catch((e) => setError(errText(e, "Couldn't load pricing.")));
  }, [api]);

  const nameOf = (id: string) => bundles?.find((b) => b.id === id)?.name ?? id;

  return (
    <section className={styles.section} aria-labelledby="pricing-title">
      <h2 id="pricing-title" className={`${styles.h2} chalk`}>Bundles</h2>
      <p className={`${styles.muted} chalk-soft`}>Every price on the website, in booking, emails and Leads comes from here. Past bookings always keep the price they were booked at.</p>
      {!dbReady && <p className={`${styles.bannerError} chalk-soft`} role="alert">The database isn&apos;t connected yet, so changes can&apos;t be saved.</p>}
      {error && <p className={`${styles.error} chalk-soft`} role="alert">{error}</p>}
      {note && <p className={`${note.kind === "ok" ? styles.ok : styles.error} chalk-soft`} role={note.kind === "error" ? "alert" : "status"}>{note.text}</p>}

      {bundles && (
        <>
          <ul className={styles.bundleList}>
            {bundles.map((b) => {
              const offer = activeOffer(b, today);
              return (
                <li key={b.id} className={`${styles.bundleRow} ${b.active === false ? styles.weekClosed : ""}`}>
                  <div>
                    <p className={`${styles.leadName} chalk-soft`}>{b.name}</p>
                    <p className={`${styles.leadMeta} chalk-soft`}>
                      {offer ? <><s>{formatMoney(toCents(b.price))}</s> {offer.label}: <b className={styles.offerInline}>{formatMoney(offer.cents)}</b>{offer.endsOn ? ` (until ${shortDate(offer.endsOn)})` : ""}</> : formatMoney(toCents(b.price))}
                      {" · "}{b.duration}
                      {b.offer?.enabled && !offer ? " · offer ended (regular price shown)" : ""}
                    </p>
                  </div>
                  <span className={`${styles.statusPill} ${b.active === false ? styles.status_pending : styles.status_confirmed}`}>{b.active === false ? "Inactive" : "Active"}</span>
                  <button type="button" className={styles.smallButton} onClick={() => { setEditing(b); setNote(null); }}>Edit</button>
                </li>
              );
            })}
          </ul>
          <ChalkButton variant="outline" onClick={() => { setEditing("new"); setNote(null); }} seed={930}>Add Bundle</ChalkButton>
          {editing && (
            <BundleEditor
              key={editing === "new" ? "new" : editing.id}
              bundle={editing === "new" ? null : editing}
              sortOrder={bundles.length}
              onCancel={() => setEditing(null)}
              onSave={async (input) => {
                const next = await api.saveBundle(input);
                setBundles(next);
                setEditing(null);
                setNote({ kind: "ok", text: `${input.name} saved. ${input.active ? "It's live on the website." : "It's inactive, so it's hidden from the website."}` });
              }}
              onDelete={editing === "new" ? undefined : () =>
                setConfirm({
                  title: `Delete ${editing.name} permanently?`,
                  text: "This removes the bundle. Bundles with bookings in their history can't be deleted; turn them off (inactive) instead.",
                  action: async () => { setBundles(await api.deleteBundle(editing.id)); setEditing(null); setNote({ kind: "ok", text: "Bundle deleted." }); },
                })}
            />
          )}

          <h2 className={`${styles.h2} chalk`}>Discount Codes</h2>
          <p className={`${styles.muted} chalk-soft`}>Customers can enter one code on the booking review step. Only one saving ever applies: if a bundle has a special offer, the better of the two is used.</p>
          <div className={styles.tableWrap}>
            <table className={styles.codeTable}>
              <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Bundles</th><th>Usage</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {codes.length === 0 && <tr><td colSpan={8} className="chalk-soft">No codes yet.</td></tr>}
                {codes.map((c) => {
                  const expired = Boolean(c.expiresOn && today > c.expiresOn);
                  const full = c.maxUses != null && c.usesCount >= c.maxUses;
                  return (
                    <tr key={c.id}>
                      <td><b className={styles.codeName}>{c.code}</b>{c.internalNote && <span className={styles.codeNote}>{c.internalNote}</span>}</td>
                      <td>{c.type === "percent" ? "Percentage" : "Fixed amount"}</td>
                      <td>{c.type === "percent" ? `${c.value}%` : `${formatMoney(toCents(c.value))} off`}</td>
                      <td>{c.bundleIds.map(nameOf).join(", ")}</td>
                      <td>{c.usesCount}{c.maxUses != null ? ` / ${c.maxUses}` : ""}{c.onePerEmail ? " · 1 per email" : ""}</td>
                      <td>{c.expiresOn ? shortDate(c.expiresOn) : "Never"}</td>
                      <td><span className={`${styles.statusPill} ${!c.active || expired || full ? styles.status_pending : styles.status_confirmed}`}>{!c.active ? "Disabled" : expired ? "Expired" : full ? "Used up" : "Active"}</span></td>
                      <td className={styles.codeActions}>
                        <button type="button" className={styles.smallButton} onClick={() => setEditingCode(c)}>Edit</button>
                        <button type="button" className={styles.smallButton} onClick={async () => { try { setCodes(await api.saveCode(toCodeInput({ ...c, active: !c.active }))); setNote({ kind: "ok", text: `${c.code} ${c.active ? "disabled" : "enabled"}.` }); } catch (e) { setNote({ kind: "error", text: errText(e, "Couldn't update the code.") }); } }}>{c.active ? "Disable" : "Enable"}</button>
                        <button type="button" className={`${styles.smallButton} ${styles.deleteBtn}`} onClick={() => setConfirm({ title: `Delete code ${c.code}?`, text: c.usesCount ? `It has been used ${c.usesCount} time${c.usesCount === 1 ? "" : "s"}. Those bookings keep their price and code; only the code itself is removed.` : "This removes the code.", action: async () => { setCodes(await api.deleteCode(c.id)); setNote({ kind: "ok", text: `${c.code} deleted.` }); } })}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ChalkButton variant="outline" onClick={() => setEditingCode("new")} seed={931}>Create Discount Code</ChalkButton>
          {editingCode && (
            <CodeEditor
              key={editingCode === "new" ? "new" : editingCode.id}
              code={editingCode === "new" ? null : editingCode}
              bundles={bundles}
              onCancel={() => setEditingCode(null)}
              onSave={async (input) => { setCodes(await api.saveCode(input)); setEditingCode(null); setNote({ kind: "ok", text: `Code ${input.code.toUpperCase()} saved.` }); }}
            />
          )}
        </>
      )}

      {confirm && createPortal(
        <div className={styles.dialogBackdrop} role="presentation" onClick={() => setConfirm(null)}>
          <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="pr-confirm-t" onClick={(e) => e.stopPropagation()}>
            <h3 id="pr-confirm-t" className={`${styles.h3} chalk`}>{confirm.title}</h3>
            <p className={`${styles.muted} chalk-soft`}>{confirm.text}</p>
            <div className={styles.photoBar}>
              <button type="button" className={styles.smallButton} onClick={() => setConfirm(null)} autoFocus>Cancel</button>
              <button type="button" className={`${styles.smallButton} ${styles.deleteBtn}`} onClick={async () => { try { await confirm.action(); } catch (e) { setNote({ kind: "error", text: errText(e, "Couldn't delete.") }); } setConfirm(null); }}>Delete Permanently</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}

const toCodeInput = (c: DiscountCode): CodeInput => ({ id: c.id, code: c.code, type: c.type, value: c.value, bundleIds: c.bundleIds, active: c.active, expiresOn: c.expiresOn, maxUses: c.maxUses, onePerEmail: c.onePerEmail, internalNote: c.internalNote });

function BundleEditor({ bundle, sortOrder, onSave, onCancel, onDelete }: { bundle: Bundle | null; sortOrder: number; onSave: (b: BundleInput) => Promise<void>; onCancel: () => void; onDelete?: () => void }) {
  const [name, setName] = useState(bundle?.name ?? "");
  const [price, setPrice] = useState(bundle ? String(bundle.price) : "");
  const [description, setDescription] = useState(bundle?.description ?? "");
  const [minutes, setMinutes] = useState(String(bundle?.durationMinutes ?? 60));
  const [photos, setPhotos] = useState(bundle?.photos ?? "");
  const [badge, setBadge] = useState(bundle?.badge ?? "");
  const [features, setFeatures] = useState<string[]>(bundle?.features ?? []);
  const [active, setActive] = useState(bundle?.active !== false);
  const [offerOn, setOfferOn] = useState(Boolean(bundle?.offer?.enabled));
  const [offerPrice, setOfferPrice] = useState(bundle?.offer?.price ? String(bundle.offer.price) : "");
  const [offerLabel, setOfferLabel] = useState(bundle?.offer?.label ?? "");
  const [offerEnds, setOfferEnds] = useState(bundle?.offer?.endsOn ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const move = (i: number, d: number) => setFeatures((f) => { const n = [...f]; const j = i + d; if (j < 0 || j >= n.length) return f; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onSave({
        id: bundle?.id, name: name.trim(), price: Number(price), description: description.trim() || null, durationMinutes: Number(minutes), photos: photos.trim() || null, badge: badge.trim() || null,
        features: features.map((f) => f.trim()).filter(Boolean), active, sortOrder: bundle?.sortOrder ?? sortOrder,
        offer: offerOn || offerPrice ? { enabled: offerOn, price: Number(offerPrice) || 0, label: offerLabel.trim() || null, endsOn: offerEnds || null } : null,
      });
    } catch (e) {
      setErr(errText(e, "Couldn't save."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.editorBox} role="group" aria-label={bundle ? `Edit ${bundle.name}` : "New bundle"}>
      <h3 className={`${styles.h3} chalk`}>{bundle ? `Edit ${bundle.name}` : "New bundle"}</h3>
      <div className={styles.editorGrid}>
        <label className={`${styles.label} chalk-soft`}>Bundle name<input className={styles.input} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>
        <label className={`${styles.label} chalk-soft`}>Regular price ($)<input className={styles.input} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label className={`${styles.label} chalk-soft`}>Session length (minutes)<input className={styles.input} type="number" min={15} max={480} step={15} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
        <label className={`${styles.label} chalk-soft`}>Edited photos (e.g. 5–8)<input className={styles.input} value={photos} maxLength={20} onChange={(e) => setPhotos(e.target.value)} /></label>
        <label className={`${styles.label} chalk-soft`}>Small label (optional, e.g. Most loved)<input className={styles.input} value={badge} maxLength={24} onChange={(e) => setBadge(e.target.value)} /></label>
        <label className={`${styles.label} chalk-soft`}>Description (optional)<input className={styles.input} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} /></label>
      </div>
      <p className={`${styles.label} chalk-soft`}>What&apos;s included</p>
      <ul className={styles.incList}>
        {features.map((f, i) => (
          <li key={i} className={styles.incRow}>
            <input className={styles.input} value={f} maxLength={80} onChange={(e) => setFeatures((x) => x.map((v, k) => (k === i ? e.target.value : v)))} aria-label={`Included item ${i + 1}`} />
            <button type="button" className={styles.smallButton} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move item ${i + 1} up`}>↑</button>
            <button type="button" className={styles.smallButton} onClick={() => move(i, 1)} disabled={i === features.length - 1} aria-label={`Move item ${i + 1} down`}>↓</button>
            <button type="button" className={`${styles.smallButton} ${styles.danger}`} onClick={() => setFeatures((x) => x.filter((_, k) => k !== i))} aria-label={`Delete item ${i + 1}`}>✕</button>
          </li>
        ))}
      </ul>
      {features.length < 12 && <button type="button" className={styles.smallButton} onClick={() => setFeatures((x) => [...x, ""])}>+ Add inclusion</button>}
      <label className={styles.toggle}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /><span className="chalk-soft">Active (shown on the website)</span></label>
      <div className={styles.offerBox}>
        <label className={styles.toggle}><input type="checkbox" checked={offerOn} onChange={(e) => setOfferOn(e.target.checked)} /><span className="chalk-soft">Enable Special Offer</span></label>
        {offerOn && (
          <div className={styles.editorGrid}>
            <label className={`${styles.label} chalk-soft`}>Offer price ($)<input className={styles.input} type="number" min={0} step="0.01" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} /></label>
            <label className={`${styles.label} chalk-soft`}>Offer label<input className={styles.input} value={offerLabel} maxLength={30} placeholder="Special offer" onChange={(e) => setOfferLabel(e.target.value)} /></label>
            <label className={`${styles.label} chalk-soft`}>Offer ends (last day)<input className={`${styles.input} ${styles.timeInput}`} type="date" value={offerEnds} onChange={(e) => setOfferEnds(e.target.value)} /></label>
          </div>
        )}
        <p className={`${styles.hintSmall} chalk-soft`}>The offer shows through its end date, then the regular price comes back automatically.</p>
      </div>
      {err && <p className={`${styles.error} chalk-soft`} role="alert">{err}</p>}
      <div className={styles.photoBar}>
        <div>{onDelete && <button type="button" className={`${styles.smallButton} ${styles.deleteBtn}`} onClick={onDelete}>Delete bundle</button>}</div>
        <div className={styles.editorActions}>
          <button type="button" className={styles.smallButton} onClick={onCancel}>Cancel</button>
          <ChalkButton variant="solid" onClick={save} disabled={busy} seed={932}>{busy ? "Saving…" : "Save bundle"}</ChalkButton>
        </div>
      </div>
    </div>
  );
}

function CodeEditor({ code, bundles, onSave, onCancel }: { code: DiscountCode | null; bundles: Bundle[]; onSave: (c: CodeInput) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState(code?.code ?? "");
  const [type, setType] = useState<"percent" | "fixed">(code?.type ?? "percent");
  const [value, setValue] = useState(code ? String(code.value) : "");
  const [ids, setIds] = useState<string[]>(code?.bundleIds ?? []);
  const [active, setActive] = useState(code?.active ?? true);
  const [expires, setExpires] = useState(code?.expiresOn ?? "");
  const [maxUses, setMaxUses] = useState(code?.maxUses ? String(code.maxUses) : "");
  const [onePer, setOnePer] = useState(code?.onePerEmail ?? false);
  const [noteText, setNoteText] = useState(code?.internalNote ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onSave({ id: code?.id, code: text.trim(), type, value: Number(value), bundleIds: ids, active, expiresOn: expires || null, maxUses: maxUses ? Number(maxUses) : null, onePerEmail: onePer, internalNote: noteText.trim() || null } as CodeInput);
    } catch (e) {
      setErr(errText(e, "Couldn't save."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.editorBox} role="group" aria-label={code ? `Edit code ${code.code}` : "New discount code"}>
      <h3 className={`${styles.h3} chalk`}>{code ? `Edit ${code.code}` : "New discount code"}</h3>
      <div className={styles.editorGrid}>
        <label className={`${styles.label} chalk-soft`}>Code<input className={styles.input} value={text} maxLength={24} placeholder="FAMILY20" onChange={(e) => setText(e.target.value.toUpperCase())} /></label>
        <label className={`${styles.label} chalk-soft`}>Discount type
          <select className={styles.input} value={type} onChange={(e) => setType(e.target.value as "percent" | "fixed")}><option value="percent">Percentage (%)</option><option value="fixed">Fixed amount ($ off)</option></select>
        </label>
        <label className={`${styles.label} chalk-soft`}>{type === "percent" ? "Percent off" : "Amount off ($)"}<input className={styles.input} type="number" min={0} step={type === "percent" ? 1 : 0.01} max={type === "percent" ? 100 : undefined} value={value} onChange={(e) => setValue(e.target.value)} /></label>
        <label className={`${styles.label} chalk-soft`}>Expiration date (last day, optional)<input className={`${styles.input} ${styles.timeInput}`} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
        <label className={`${styles.label} chalk-soft`}>Maximum total uses (optional)<input className={styles.input} type="number" min={1} step={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} /></label>
        <label className={`${styles.label} chalk-soft`}>Internal note (never shown to customers)<input className={styles.input} value={noteText} maxLength={200} placeholder="Friends and family only" onChange={(e) => setNoteText(e.target.value)} /></label>
      </div>
      <p className={`${styles.label} chalk-soft`}>Applies to</p>
      <div className={styles.checkGrid}>
        {bundles.map((b) => (
          <label key={b.id} className={styles.toggle}>
            <input type="checkbox" checked={ids.includes(b.id)} onChange={(e) => setIds((x) => (e.target.checked ? [...x, b.id] : x.filter((y) => y !== b.id)))} />
            <span className="chalk-soft">{b.name}{b.active === false ? " (inactive)" : ""}</span>
          </label>
        ))}
      </div>
      <label className={styles.toggle}><input type="checkbox" checked={onePer} onChange={(e) => setOnePer(e.target.checked)} /><span className="chalk-soft">One use per customer email</span></label>
      <label className={styles.toggle}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /><span className="chalk-soft">Active</span></label>
      {code && <p className={`${styles.hintSmall} chalk-soft`}>Created {new Date(code.createdAt).toLocaleDateString()} · used {code.usesCount} time{code.usesCount === 1 ? "" : "s"}</p>}
      {err && <p className={`${styles.error} chalk-soft`} role="alert">{err}</p>}
      <div className={styles.photoBar}>
        <span />
        <div className={styles.editorActions}>
          <button type="button" className={styles.smallButton} onClick={onCancel}>Cancel</button>
          <ChalkButton variant="solid" onClick={save} disabled={busy} seed={933}>{busy ? "Saving…" : "Save code"}</ChalkButton>
        </div>
      </div>
    </div>
  );
}
