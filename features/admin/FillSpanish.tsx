"use client";

import { useEffect, useState } from "react";
import { translateToSpanish, translationStatus } from "@/lib/admin/client";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

let status: Promise<boolean> | null = null;

/** Is automatic translation on (checked once per visit)? null while checking. */
export function useTranslationOn(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void (status ??= translationStatus()).then((value) => live && setOn(value));
    return () => {
      live = false;
    };
  }, []);
  return on;
}

/** One line for the top of a page: Spanish fills itself in, or why it copies the English. */
export function TranslationStatus() {
  const on = useTranslationOn();
  if (on === null) return null;
  return (
    <p className={cn(on ? styles.translateOn : styles.translateOff, "chalk-soft")} role="note">
      {on
        ? "Spanish fills itself in: leave any Spanish box empty and it's translated when you save, or press “Fill in Spanish for me” to see it first."
        : "Automatic Spanish is off right now, so an empty Spanish box copies the English. It turns on once the translation key is added in Vercel."}
    </p>
  );
}

/**
 * "Fill in Spanish for me" (owner, Nov 11): translates the English boxes and puts the Spanish in the form, so the owner
 * sees it before saving. Empty English stays empty. Hidden while translation is off (TranslationStatus explains).
 */
export function FillSpanishButton({ english, onFill, disabled = false }: { english: string[]; onFill: (spanish: string[]) => void; disabled?: boolean }) {
  const on = useTranslationOn();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!on) return null;
  const texts = english.map((t) => t.trim());
  return (
    <div className={styles.fillSpanish}>
      <button
        type="button"
        className={styles.smallButton}
        disabled={disabled || busy || !texts.some(Boolean)}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const { spanish } = await translateToSpanish(texts);
            onFill(spanish.map((s, i) => (texts[i] ? s : "")));
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Couldn't translate just now.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Translating…" : "Fill in Spanish for me"}
      </button>
      {err && <p className={cn(styles.error, "chalk-soft")} role="alert">{err}</p>}
    </div>
  );
}
