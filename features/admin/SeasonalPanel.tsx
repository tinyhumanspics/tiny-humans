"use client";

import { useState } from "react";
import { MAX_SEASONAL_OFFERS, type SeasonalOfferTheme } from "@/config/seasonal";
import { THEME_IDS, themes } from "@/config/themes";
import type { SeasonalOffer, SeasonalOfferSettings, SiteSettings } from "@/lib/settings/types";
import { isBuiltInSeasonalOffer } from "@/lib/settings/defaults";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import { cn } from "@/lib/cn";
import styles from "./Admin.module.css";

type Note = { kind: "ok" | "error"; text: string } | null;
const themeName = (id: SeasonalOfferTheme) => (id === "any" ? "Any theme" : `${themes[id].label} theme`);

/**
 * /admin → Seasonal Landing: the seasonal offer boxes on the ad page (Home Sweet Home) and the home page. The two
 * built-in ones (Thanksgiving, First Christmas) can be switched off but not deleted; the owner can add more (owner,
 * Nov 10: "Valentine's Day, show love to your tiny human") and delete those.
 */
export default function SeasonalPanel({ settings, onSave }: { settings: SiteSettings; onSave: (s: SiteSettings) => Promise<SiteSettings> }) {
  const [draft, setDraft] = useState<SeasonalOffer[]>(settings.seasonalOffers);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.seasonalOffers);

  const update = <K extends keyof SeasonalOffer>(id: string, field: K, value: SeasonalOffer[K]) => {
    setDraft((current) => current.map((offer) => (offer.id === id ? { ...offer, [field]: value } : offer)));
    setNote(null);
  };

  const updateSpanish = (id: string, field: "title" | "description", value: string) => {
    setDraft((current) =>
      current.map((offer) => {
        if (offer.id !== id) return offer;
        const next = { title: offer.spanish?.title ?? "", description: offer.spanish?.description ?? "", [field]: value };
        return { ...offer, spanish: next.title || next.description ? next : null };
      }),
    );
    setNote(null);
  };

  const add = () => {
    const blank: SeasonalOfferSettings = { enabled: false, title: "", description: "", cutoff: "", spanish: null };
    setDraft((current) => [...current, { id: `offer-${Date.now().toString(36)}`, name: "New offer", themeId: "any", ...blank }]);
    setNote(null);
  };

  const remove = (id: string) => {
    setDraft((current) => current.filter((offer) => offer.id !== id));
    setNote({ kind: "ok", text: "Offer removed. Save to make it final." });
  };

  const save = async () => {
    const incomplete = draft.find((offer) => !offer.name.trim() || !offer.title.trim() || !offer.description.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(offer.cutoff));
    if (incomplete) {
      setNote({ kind: "error", text: `Complete the name, title, description and last session date for ${incomplete.name.trim() || "the new offer"}.` });
      return;
    }
    const incompleteSpanish = draft.find((offer) => offer.spanish && (!offer.spanish.title.trim() || !offer.spanish.description.trim()));
    if (incompleteSpanish) {
      setNote({ kind: "error", text: `Complete both Spanish fields for ${incompleteSpanish.name}, or leave both blank and they're filled in for you when you save.` });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const saved = await onSave({ ...settings, seasonalOffers: draft });
      setDraft(saved.seasonalOffers);
      setNote({ kind: "ok", text: "Seasonal offers saved. The ones switched on show on the ad page and the home page while their theme is live." });
    } catch (error) {
      setNote({ kind: "error", text: error instanceof Error ? error.message : "Couldn't save the seasonal offers." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="seasonal-title">
      <h2 id="seasonal-title" className={cn(styles.h2, "chalk")}>Seasonal offers</h2>
      <p className={cn(styles.muted, "chalk-soft")}>
        Each offer you switch on shows on the ad page (Home Sweet Home) and the home page while its theme is live (or with any theme), and disappears
        by itself after its last session date. When a bundle special offer is running, the box also shows its line (for example &ldquo;Thanksgiving
        offer: 10% off every bundle&rdquo;).
      </p>
      <p className={cn(styles.hintSmall, "chalk-soft")}>Changing these settings does not change bundle prices or discounts: set those in Pricing &amp; Promotions.</p>

      <div className={styles.seasonalAdminGrid}>
        {draft.map((offer, index) => {
          const builtIn = isBuiltInSeasonalOffer(offer.id);
          const live = offer.themeId === "any" || settings.themeId === offer.themeId;
          return (
            <ChalkBox key={offer.id} className={styles.seasonalAdminCard} seed={940 + index} wobble={2.2} strokeWidth={2.2} color={offer.enabled ? "var(--sun-yellow)" : "var(--chalk-white)"}>
              <div className={styles.seasonalAdminHead}>
                <div>
                  <h3 className={cn(styles.h3, "chalk")}>{offer.name || "New offer"}</h3>
                  <p className={cn(styles.hintSmall, "chalk-soft")}>
                    {themeName(offer.themeId)} · {offer.themeId === "any" ? "shows with every theme" : live ? "matching theme is live" : "switch to this theme when ready"}
                  </p>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={offer.enabled} onChange={(event) => update(offer.id, "enabled", event.target.checked)} />
                  Show offer
                </label>
              </div>

              {!builtIn && (
                <label className={styles.ruleField}>
                  <span className={styles.label}>Name (only you see it)</span>
                  <input className={styles.input} value={offer.name} maxLength={40} placeholder="Valentine's Day" onChange={(event) => update(offer.id, "name", event.target.value)} />
                </label>
              )}
              <label className={styles.ruleField}>
                <span className={styles.label}>Shows with</span>
                <select className={styles.input} value={offer.themeId} onChange={(event) => update(offer.id, "themeId", event.target.value as SeasonalOfferTheme)}>
                  <option value="any">Any theme</option>
                  {THEME_IDS.map((id) => (
                    <option key={id} value={id}>{themes[id].label} theme</option>
                  ))}
                </select>
              </label>
              <label className={styles.ruleField}>
                <span className={styles.label}>Offer title</span>
                <input className={styles.input} value={offer.title} maxLength={90} placeholder={builtIn ? undefined : "Show love to your tiny human"} onChange={(event) => update(offer.id, "title", event.target.value)} />
              </label>
              <label className={styles.ruleField}>
                <span className={styles.label}>Short description</span>
                <textarea className={cn(styles.input, styles.seasonalTextarea)} value={offer.description} maxLength={240} onChange={(event) => update(offer.id, "description", event.target.value)} />
              </label>
              <p className={cn(styles.label, "chalk-soft")}>Spanish (left blank = filled in for you when you save)</p>
              <label className={styles.ruleField}>
                <span className={styles.label}>Spanish offer title</span>
                <input className={styles.input} value={offer.spanish?.title ?? ""} maxLength={90} onChange={(event) => updateSpanish(offer.id, "title", event.target.value)} />
              </label>
              <label className={styles.ruleField}>
                <span className={styles.label}>Spanish short description</span>
                <textarea className={cn(styles.input, styles.seasonalTextarea)} value={offer.spanish?.description ?? ""} maxLength={240} onChange={(event) => updateSpanish(offer.id, "description", event.target.value)} />
              </label>
              <label className={styles.ruleField}>
                <span className={styles.label}>Last session date</span>
                <input className={cn(styles.input, styles.dateInput)} type="date" value={offer.cutoff} onChange={(event) => update(offer.id, "cutoff", event.target.value)} />
              </label>
              {!builtIn && (
                <button type="button" className={cn(styles.smallButton, styles.danger)} onClick={() => remove(offer.id)}>
                  Delete this offer
                </button>
              )}
            </ChalkBox>
          );
        })}
      </div>

      <div className={styles.editorActions}>
        {draft.length < MAX_SEASONAL_OFFERS && (
          <button type="button" className={styles.smallButton} onClick={add}>
            + Add another offer
          </button>
        )}
      </div>
      <div className={styles.editorActions}>
        <ChalkButton variant="solid" onClick={save} disabled={!dirty || busy} seed={944}>{busy ? "Saving…" : "Save seasonal offers"}</ChalkButton>
        <ChalkButton href="/home-sweet-home" variant="outline" seed={945}>View ad page</ChalkButton>
        <ChalkButton href="/" variant="outline" seed={946}>View home page</ChalkButton>
        {dirty && <span className={cn(styles.unsaved, "chalk-soft")}>Unsaved changes</span>}
      </div>
      {note && <p className={cn(note.kind === "ok" ? styles.ok : styles.error, "chalk-soft")} role={note.kind === "error" ? "alert" : "status"}>{note.text}</p>}
    </section>
  );
}
