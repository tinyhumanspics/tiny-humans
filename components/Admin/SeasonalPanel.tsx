"use client";

import { useState } from "react";
import { SEASONAL_OFFER_DEFINITIONS, type SeasonalOfferId } from "@/config/seasonal";
import { themes } from "@/config/themes";
import type { SeasonalOfferSettings, SiteSettings } from "@/lib/settings/types";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import { cn } from "@/lib/cn";
import styles from "./Admin.module.css";

type Note = { kind: "ok" | "error"; text: string } | null;

export default function SeasonalPanel({ settings, onSave }: { settings: SiteSettings; onSave: (s: SiteSettings) => Promise<SiteSettings> }) {
  const [draft, setDraft] = useState(settings.seasonalOffers);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.seasonalOffers);

  const update = <K extends keyof SeasonalOfferSettings>(id: SeasonalOfferId, field: K, value: SeasonalOfferSettings[K]) => {
    setDraft((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
    setNote(null);
  };

  const updateSpanish = (id: SeasonalOfferId, field: "title" | "description", value: string) => {
    setDraft((current) => {
      const next = { title: current[id].spanish?.title ?? "", description: current[id].spanish?.description ?? "", [field]: value };
      return { ...current, [id]: { ...current[id], spanish: next.title || next.description ? next : null } };
    });
    setNote(null);
  };

  const save = async () => {
    const incomplete = SEASONAL_OFFER_DEFINITIONS.find(({ id }) => {
      const offer = draft[id];
      return !offer.title.trim() || !offer.description.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(offer.cutoff);
    });
    if (incomplete) {
      setNote({ kind: "error", text: `Complete the title, description and cutoff for ${incomplete.adminLabel}.` });
      return;
    }
    const incompleteSpanish = SEASONAL_OFFER_DEFINITIONS.find(({ id }) => {
      const spanish = draft[id].spanish;
      return spanish && (!spanish.title.trim() || !spanish.description.trim());
    });
    if (incompleteSpanish) {
      setNote({ kind: "error", text: `Complete both Spanish fields for ${incompleteSpanish.adminLabel}, or leave both blank.` });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const saved = await onSave({ ...settings, seasonalOffers: draft });
      setDraft(saved.seasonalOffers);
      setNote({ kind: "ok", text: "Seasonal landing settings are live." });
    } catch (error) {
      setNote({ kind: "error", text: error instanceof Error ? error.message : "Couldn't save the seasonal offers." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="seasonal-title">
      <h2 id="seasonal-title" className={cn(styles.h2, "chalk")}>Seasonal landing offers</h2>
      <p className={cn(styles.muted, "chalk-soft")}>Each offer appears on Home Sweet Home only while its matching theme is live, and disappears automatically after its last-session date.</p>
      <p className={cn(styles.hintSmall, "chalk-soft")}>Changing these settings does not change bundle prices or discounts.</p>

      <div className={styles.seasonalAdminGrid}>
        {SEASONAL_OFFER_DEFINITIONS.map((definition, index) => {
          const offer = draft[definition.id];
          const theme = themes[definition.themeId];
          const matchingTheme = settings.themeId === definition.themeId;
          return (
            <ChalkBox key={definition.id} className={styles.seasonalAdminCard} seed={940 + index} wobble={2.2} strokeWidth={2.2} color={offer.enabled ? "var(--sun-yellow)" : "var(--chalk-white)"}>
              <div className={styles.seasonalAdminHead}>
                <div>
                  <h3 className={cn(styles.h3, "chalk")}>{definition.adminLabel}</h3>
                  <p className={cn(styles.hintSmall, "chalk-soft")}>{theme.label} theme · {matchingTheme ? "matching theme is live" : "switch to this theme when ready"}</p>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={offer.enabled} onChange={(event) => update(definition.id, "enabled", event.target.checked)} />
                  Show offer
                </label>
              </div>

              <label className={styles.ruleField}>
                <span className={styles.label}>Offer title</span>
                <input className={styles.input} value={offer.title} maxLength={90} onChange={(event) => update(definition.id, "title", event.target.value)} />
              </label>
              <label className={styles.ruleField}>
                <span className={styles.label}>Short description</span>
                <textarea className={cn(styles.input, styles.seasonalTextarea)} value={offer.description} maxLength={240} onChange={(event) => update(definition.id, "description", event.target.value)} />
              </label>
              <p className={cn(styles.label, "chalk-soft")}>Spanish (optional until the Spanish site is published)</p>
              <label className={styles.ruleField}>
                <span className={styles.label}>Spanish offer title</span>
                <input className={styles.input} value={offer.spanish?.title ?? ""} maxLength={90} onChange={(event) => updateSpanish(definition.id, "title", event.target.value)} />
              </label>
              <label className={styles.ruleField}>
                <span className={styles.label}>Spanish short description</span>
                <textarea className={cn(styles.input, styles.seasonalTextarea)} value={offer.spanish?.description ?? ""} maxLength={240} onChange={(event) => updateSpanish(definition.id, "description", event.target.value)} />
              </label>
              <label className={styles.ruleField}>
                <span className={styles.label}>Last session date</span>
                <input className={cn(styles.input, styles.dateInput)} type="date" value={offer.cutoff} onChange={(event) => update(definition.id, "cutoff", event.target.value)} />
              </label>
            </ChalkBox>
          );
        })}
      </div>

      <div className={styles.editorActions}>
        <ChalkButton variant="solid" onClick={save} disabled={!dirty || busy} seed={944}>{busy ? "Saving…" : "Save seasonal offers"}</ChalkButton>
        <ChalkButton href="/home-sweet-home" variant="outline" seed={945}>View landing page</ChalkButton>
        {dirty && <span className={cn(styles.unsaved, "chalk-soft")}>Unsaved changes</span>}
      </div>
      {note && <p className={cn(note.kind === "ok" ? styles.ok : styles.error, "chalk-soft")} role={note.kind === "error" ? "alert" : "status"}>{note.text}</p>}
    </section>
  );
}
