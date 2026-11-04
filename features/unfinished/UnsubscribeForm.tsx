"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import en from "@/messages/en.json";
import { cn } from "@/lib/cn";
import type { AppLocale } from "@/i18n/config";
import styles from "@/features/after-session/AfterSession.module.css";

type View = "ask" | "done" | "invalid";

/**
 * /unsubscribe?t=… (link at the bottom of marketing emails). A button, not an automatic unsubscribe on opening:
 * email security scanners open links in advance and would unsubscribe people by accident.
 */
export default function UnsubscribeForm({ messages = en.unsubscribe }: { locale?: AppLocale; messages?: typeof en.unsubscribe }) {
  const m = messages;
  const token = useSearchParams().get("t") ?? "";
  const [view, setView] = useState<View>(token ? "ask" : "invalid");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unsubscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      if (res.status === 404) return setView("invalid");
      if (!res.ok) throw new Error();
      setView("done");
    } catch {
      setError(m.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn("container", styles.page)} aria-labelledby="unsubscribe-title">
      <ChalkBox className={styles.panel} seed={441} wobble={3.4} strokeWidth={2.8}>
        {view === "ask" && (
          <>
            <h1 id="unsubscribe-title" className={cn(styles.title, "chalk")}>{m.title}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{m.text}</p>
            {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
            <div className={styles.actions}>
              <span />
              <ChalkButton type="button" variant="solid" disabled={busy} seed={442} onClick={unsubscribe}>{busy ? m.sending : m.button}</ChalkButton>
            </div>
          </>
        )}
        {view === "done" && (
          <div role="status">
            <h1 id="unsubscribe-title" className={cn(styles.title, "chalk")} tabIndex={-1}>{m.doneTitle}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{m.doneText}</p>
          </div>
        )}
        {view === "invalid" && (
          <>
            <h1 id="unsubscribe-title" className={cn(styles.title, "chalk")}>{m.invalidTitle}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{m.invalidText}</p>
          </>
        )}
      </ChalkBox>
    </section>
  );
}
